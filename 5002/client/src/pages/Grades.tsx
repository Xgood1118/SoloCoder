import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, Course, Grade, Semester } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { Role } from '../types'
import { formatDate } from '../utils'

export default function Grades() {
  const [courses, setCourses] = useState<Course[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [filters, setFilters] = useState({
    semesterId: '',
  })
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [gradeData, setGradeData] = useState<Record<string, { regularScore: number; finalScore: number }>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deadlineInfo, setDeadlineInfo] = useState<any>(null)

  const { user } = useAuthStore()
  const isTeacher = user?.role === Role.TEACHER
  const isStudent = user?.role === Role.STUDENT
  const isAdmin = user?.role === Role.ADMIN

  useEffect(() => {
    const fetchData = async () => {
      try {
        const semestersRes = await api.get<ApiResponse<Semester[]>>('/semesters')
        setSemesters(semestersRes.data.data || [])

        const activeSemester = semestersRes.data.data?.find((s) => s.isActive)
        if (activeSemester) {
          setFilters((prev) => ({ ...prev, semesterId: activeSemester.id }))
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (filters.semesterId) {
      fetchCourses()
      if (isStudent) {
        fetchMyGrades()
      }
      if (isAdmin) {
        fetchAllGrades()
      }
    }
  }, [filters.semesterId])

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseGrades()
      fetchDeadlineInfo()
    }
  }, [selectedCourse])

  const fetchCourses = async () => {
    try {
      let endpoint = '/courses'
      if (isTeacher) {
        endpoint = '/courses/my'
      }
      const response = await api.get<ApiResponse<Course[]>>(endpoint, {
        params: { semesterId: filters.semesterId },
      })
      setCourses(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const fetchMyGrades = async () => {
    try {
      const response = await api.get<ApiResponse<Grade[]>>('/grades/my', {
        params: { semesterId: filters.semesterId },
      })
      setGrades(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch my grades:', error)
    }
  }

  const fetchAllGrades = async () => {
    try {
      const response = await api.get<ApiResponse<Grade[]>>('/grades', {
        params: { semesterId: filters.semesterId },
      })
      setGrades(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch all grades:', error)
    }
  }

  const fetchCourseGrades = async () => {
    try {
      const response = await api.get<ApiResponse<Grade[]>>(`/grades/course/${selectedCourse!.id}`)
      const courseGrades = response.data.data || []
      setGrades(courseGrades)

      const initialGradeData: Record<string, { regularScore: number; finalScore: number }> = {}
      courseGrades.forEach((g) => {
        initialGradeData[g.studentId] = {
          regularScore: g.regularScore ?? 0,
          finalScore: g.finalScore ?? 0,
        }
      })
      setGradeData(initialGradeData)
    } catch (error) {
      console.error('Failed to fetch course grades:', error)
    }
  }

  const fetchDeadlineInfo = async () => {
    try {
      const response = await api.get<ApiResponse<any>>('/grades/deadline-info', {
        params: { semesterId: selectedCourse!.semesterId },
      })
      setDeadlineInfo(response.data.data)
    } catch (error) {
      console.error('Failed to fetch deadline info:', error)
    }
  }

  const calculateTotalScore = (regular: number, final: number) => {
    return Math.round(regular * 0.4 + final * 0.6)
  }

  const handleSubmitGrades = async () => {
    if (!selectedCourse) return

    const gradeEntries = Object.entries(gradeData).map(([studentId, scores]) => ({
      studentId,
      courseId: selectedCourse.id,
      regularScore: scores.regularScore,
      finalScore: scores.finalScore,
    }))

    if (gradeEntries.some((g) => g.regularScore < 0 || g.regularScore > 100 || g.finalScore < 0 || g.finalScore > 100)) {
      alert('成绩必须在0-100之间')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/grades/batch', { grades: gradeEntries })
      alert('成绩提交成功')
      fetchCourseGrades()
    } catch (error: any) {
      alert(error.response?.data?.error || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">成绩管理</h2>
        {deadlineInfo && selectedCourse && (
          <div
            className={`px-4 py-2 rounded-lg ${
              deadlineInfo.isOverdue
                ? 'bg-red-100 text-red-800'
                : deadlineInfo.daysRemaining <= 3
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            成绩录入截止：{formatDate(deadlineInfo.deadline)}
            {deadlineInfo.isOverdue ? ' (已逾期)' : ` (还剩${deadlineInfo.daysRemaining}天)`}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
          <select
            className="select w-48"
            value={filters.semesterId}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, semesterId: e.target.value }))
              setSelectedCourse(null)
            }}
          >
            <option value="">请选择学期</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isActive && '(当前)'}
              </option>
            ))}
          </select>
        </div>
        {isTeacher && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程</label>
            <select
              className="select w-64"
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const course = courses.find((c) => c.id === e.target.value)
                setSelectedCourse(course || null)
              }}
            >
              <option value="">请选择课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) - {c._count?.enrollments || 0}人
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isTeacher && selectedCourse && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">{selectedCourse.name}</h3>
              <p className="text-sm text-gray-500">课程代码：{selectedCourse.code} | 学分：{selectedCourse.credits}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">评分规则：平时40% + 期末60%</span>
              <button
                className="btn btn-primary"
                onClick={handleSubmitGrades}
                disabled={submitting || deadlineInfo?.isOverdue}
              >
                {submitting ? '提交中...' : '提交成绩'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>学生姓名</th>
                  <th>平时成绩(40%)</th>
                  <th>期末成绩(60%)</th>
                  <th>总评</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {grades.map((grade) => (
                  <tr key={grade.id}>
                    <td>{grade.student?.studentId}</td>
                    <td className="font-medium">{grade.student?.name}</td>
                    <td>
                      <input
                        type="number"
                        className="input w-24"
                        min="0"
                        max="100"
                        value={gradeData[grade.studentId]?.regularScore ?? ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0
                          setGradeData((prev) => ({
                            ...prev,
                            [grade.studentId]: {
                              ...prev[grade.studentId],
                              regularScore: Math.min(100, Math.max(0, value)),
                            },
                          }))
                        }}
                        disabled={deadlineInfo?.isOverdue}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input w-24"
                        min="0"
                        max="100"
                        value={gradeData[grade.studentId]?.finalScore ?? ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0
                          setGradeData((prev) => ({
                            ...prev,
                            [grade.studentId]: {
                              ...prev[grade.studentId],
                              finalScore: Math.min(100, Math.max(0, value)),
                            },
                          }))
                        }}
                        disabled={deadlineInfo?.isOverdue}
                      />
                    </td>
                    <td>
                      <span
                        className={`font-bold ${
                          calculateTotalScore(
                            gradeData[grade.studentId]?.regularScore || 0,
                            gradeData[grade.studentId]?.finalScore || 0
                          ) >= 60
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {calculateTotalScore(
                          gradeData[grade.studentId]?.regularScore || 0,
                          gradeData[grade.studentId]?.finalScore || 0
                        )}
                      </span>
                    </td>
                    <td>
                      {grade.isPassed !== undefined ? (
                        grade.isPassed ? (
                          <span className="badge-green">已通过</span>
                        ) : (
                          <span className="badge-red">未通过</span>
                        )
                      ) : (
                        <span className="badge-gray">未录入</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {grades.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无学生选课数据</div>
          )}
        </div>
      )}

      {isStudent && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>课程代码</th>
                  <th>学分</th>
                  <th>授课教师</th>
                  <th>平时成绩</th>
                  <th>期末成绩</th>
                  <th>总评</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {grades.map((grade) => (
                  <tr key={grade.id}>
                    <td className="font-medium">{grade.course?.name}</td>
                    <td>{grade.course?.code}</td>
                    <td>{grade.course?.credits}</td>
                    <td>{grade.course?.teacher?.name}</td>
                    <td>{grade.regularScore !== undefined ? grade.regularScore : '-'}</td>
                    <td>{grade.finalScore !== undefined ? grade.finalScore : '-'}</td>
                    <td>
                      {grade.totalScore !== undefined ? (
                        <span
                          className={`font-bold ${
                            grade.totalScore >= 60 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {grade.totalScore}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {grade.isPassed === true ? (
                        <span className="badge-green">已通过</span>
                      ) : grade.isPassed === false ? (
                        <span className="badge-red">未通过</span>
                      ) : (
                        <span className="badge-yellow">待出分</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {grades.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无成绩数据</div>
          )}

          {grades.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">已修课程</p>
                <p className="text-2xl font-bold text-blue-600">{grades.length}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">已获学分</p>
                <p className="text-2xl font-bold text-green-600">
                  {grades
                    .filter((g) => g.isPassed)
                    .reduce((sum, g) => sum + (g.course?.credits || 0), 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">平均分</p>
                <p className="text-2xl font-bold text-purple-600">
                  {grades.length > 0
                    ? Math.round(
                        grades
                          .filter((g) => g.totalScore !== undefined)
                          .reduce((sum, g) => sum + (g.totalScore || 0), 0) /
                          grades.filter((g) => g.totalScore !== undefined).length || 0
                      )
                    : '-'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && !selectedCourse && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>学生姓名</th>
                  <th>平时成绩</th>
                  <th>期末成绩</th>
                  <th>总评</th>
                  <th>状态</th>
                  <th>录入时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {grades.map((grade) => (
                  <tr key={grade.id}>
                    <td className="font-medium">{grade.course?.name}</td>
                    <td>{grade.student?.name}</td>
                    <td>{grade.regularScore !== undefined ? grade.regularScore : '-'}</td>
                    <td>{grade.finalScore !== undefined ? grade.finalScore : '-'}</td>
                    <td>
                      {grade.totalScore !== undefined ? (
                        <span
                          className={`font-bold ${
                            grade.totalScore >= 60 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {grade.totalScore}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {grade.isPassed === true ? (
                        <span className="badge-green">已通过</span>
                      ) : grade.isPassed === false ? (
                        <span className="badge-red">未通过</span>
                      ) : (
                        <span className="badge-gray">未录入</span>
                      )}
                    </td>
                    <td>{grade.enteredAt ? formatDate(grade.enteredAt) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {grades.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无成绩数据</div>
          )}
        </div>
      )}
    </div>
  )
}
