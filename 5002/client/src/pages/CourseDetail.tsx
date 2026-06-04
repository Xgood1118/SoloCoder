import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { ApiResponse, Course, Enrollment, Schedule, Grade, AttendanceStatus } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { Role } from '../types'
import { formatDate, weekDayMap, periodTimeMap } from '../utils'

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Enrollment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [activeTab, setActiveTab] = useState<'info' | 'students' | 'schedule' | 'grades'>('info')
  const [loading, setLoading] = useState(true)
  const [gradeForm, setGradeForm] = useState<Record<string, { regularScore: number; finalScore: number }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({})
  const [attendanceScheduleId, setAttendanceScheduleId] = useState('')

  const { user } = useAuthStore()
  const isTeacher = user?.role === Role.TEACHER
  const isAdmin = user?.role === Role.ADMIN

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return

      try {
        const [courseRes, studentsRes, schedulesRes, gradesRes] = await Promise.all([
          api.get<ApiResponse<Course>>(`/courses/${id}`),
          api.get<ApiResponse<Enrollment[]>>(`/courses/${id}/students`),
          api.get<ApiResponse<Schedule[]>>('/schedules', { params: { courseId: id } }),
          api.get<ApiResponse<Grade[]>>(`/courses/${id}/grades`),
        ])

        setCourse(courseRes.data.data!)
        setStudents(studentsRes.data.data || [])
        setSchedules(schedulesRes.data.data || [])
        setGrades(gradesRes.data.data || [])

        const initialGradeForm: Record<string, { regularScore: number; finalScore: number }> = {}
        studentsRes.data.data?.forEach((enrollment) => {
          const existingGrade = gradesRes.data.data?.find(
            (g) => g.studentId === enrollment.studentId
          )
          initialGradeForm[enrollment.studentId] = {
            regularScore: existingGrade?.regularScore ?? 0,
            finalScore: existingGrade?.finalScore ?? 0,
          }
        })
        setGradeForm(initialGradeForm)

        const initialAttendance: Record<string, AttendanceStatus> = {}
        studentsRes.data.data?.forEach((enrollment) => {
          initialAttendance[enrollment.studentId] = AttendanceStatus.PRESENT
        })
        setAttendanceData(initialAttendance)
      } catch (error) {
        console.error('Failed to fetch course data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const handleBatchGradeSubmit = async () => {
    if (!id) return
    setSubmitting(true)

    try {
      const gradesData = Object.entries(gradeForm).map(([studentId, scores]) => ({
        studentId,
        courseId: id,
        regularScore: scores.regularScore,
        finalScore: scores.finalScore,
      }))

      await api.post('/grades/batch-enter', { grades: gradesData })

      const response = await api.get<ApiResponse<Grade[]>>(`/courses/${id}/grades`)
      setGrades(response.data.data || [])
      alert('成绩录入成功')
    } catch (error: any) {
      alert(error.response?.data?.error || '成绩录入失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAttendanceSubmit = async () => {
    if (!attendanceScheduleId) {
      alert('请选择上课时间')
      return
    }

    try {
      const records = Object.entries(attendanceData).map(([studentId, status]) => ({
        studentId,
        status,
      }))

      await api.post('/attendance/record', {
        scheduleId: attendanceScheduleId,
        records,
      })

      alert('考勤记录成功')
    } catch (error: any) {
      alert(error.response?.data?.error || '考勤记录失败')
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!course) {
    return <div className="text-center py-12">课程不存在</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/courses')}
            className="text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 返回列表
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{course.name}</h2>
          <p className="text-gray-500">{course.code} · {course.credits}学分</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {[
          { key: 'info', label: '课程信息' },
          { key: 'students', label: '选课名单' },
          { key: 'schedule', label: '课程安排' },
          { key: 'grades', label: '成绩管理' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="card">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">课程名称</p>
              <p className="text-lg font-medium">{course.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">课程代码</p>
              <p className="text-lg font-medium">{course.code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">学分</p>
              <p className="text-lg font-medium">{course.credits}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">所属院系</p>
              <p className="text-lg font-medium">{course.department?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">授课教师</p>
              <p className="text-lg font-medium">{course.teacher?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">学期</p>
              <p className="text-lg font-medium">{course.semester?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">选课人数</p>
              <p className="text-lg font-medium">
                {course._count?.enrollments || 0} / {course.maxStudents}
                <span className="text-sm text-gray-500 ml-2">(最低 {course.minStudents} 人)</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">选课时间</p>
              <p className="text-lg font-medium">
                {formatDate(course.semester?.courseSelectionStart!)} -{' '}
                {formatDate(course.semester?.courseSelectionEnd!)}
              </p>
            </div>
            {course.description && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">课程描述</p>
                <p className="text-gray-800">{course.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="space-y-4">
          {isTeacher && schedules.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">记录考勤</h3>
              <div className="flex gap-4 mb-4">
                <select
                  className="select w-64"
                  value={attendanceScheduleId}
                  onChange={(e) => setAttendanceScheduleId(e.target.value)}
                >
                  <option value="">选择上课时间</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {weekDayMap[s.dayOfWeek]} 第{s.startPeriod}-{s.endPeriod}节 ({periodTimeMap[s.startPeriod]})
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={handleAttendanceSubmit}>
                  提交考勤
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">
              选课名单 ({students.length}人)
            </h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>学号</th>
                    <th>姓名</th>
                    <th>班级</th>
                    <th>选课时间</th>
                    {isTeacher && <th>考勤状态</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td>{enrollment.student?.studentId}</td>
                      <td className="font-medium">{enrollment.student?.name}</td>
                      <td>{enrollment.class?.name}</td>
                      <td>{formatDate(enrollment.enrolledAt)}</td>
                      {isTeacher && (
                        <td>
                          <select
                            className="select w-32"
                            value={attendanceData[enrollment.studentId]}
                            onChange={(e) =>
                              setAttendanceData((prev) => ({
                                ...prev,
                                [enrollment.studentId]: e.target.value as AttendanceStatus,
                              }))
                            }
                          >
                            <option value={AttendanceStatus.PRESENT}>出勤</option>
                            <option value={AttendanceStatus.ABSENT}>缺勤</option>
                            <option value={AttendanceStatus.LATE}>迟到</option>
                            <option value={AttendanceStatus.EXCUSED}>请假</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">课程安排</h3>
          {schedules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>星期</th>
                    <th>节次</th>
                    <th>时间</th>
                    <th>教室</th>
                    <th>起止日期</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td>{weekDayMap[schedule.dayOfWeek]}</td>
                      <td>
                        第{schedule.startPeriod}-{schedule.endPeriod}节
                      </td>
                      <td>{periodTimeMap[schedule.startPeriod]}</td>
                      <td>
                        {schedule.classroom?.building} {schedule.classroom?.roomNumber}
                      </td>
                      <td>
                        {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                      </td>
                      <td>
                        {schedule.hasConflict ? (
                          <span className="badge badge-red">有冲突</span>
                        ) : (
                          <span className="badge badge-green">正常</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">暂无排课安排</div>
          )}
        </div>
      )}

      {activeTab === 'grades' && (
        <div className="space-y-4">
          {isTeacher && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">录入成绩</h3>
                <button
                  className="btn btn-primary"
                  onClick={handleBatchGradeSubmit}
                  disabled={submitting}
                >
                  {submitting ? '提交中...' : '批量提交'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                成绩计算公式：总评 = 平时成绩 × 40% + 期末成绩 × 60%，60分及以上及格
              </p>
            </div>
          )}

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">成绩列表</h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>学号</th>
                    <th>姓名</th>
                    <th>班级</th>
                    {isTeacher && <th>平时成绩</th>}
                    {isTeacher && <th>期末成绩</th>}
                    <th>总评成绩</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((enrollment) => {
                    const grade = grades.find((g) => g.studentId === enrollment.studentId)
                    const scores = gradeForm[enrollment.studentId] || { regularScore: 0, finalScore: 0 }
                    const totalScore = grade?.totalScore ?? (
                      scores.regularScore * 0.4 + scores.finalScore * 0.6
                    )
                    const isPassed = totalScore >= 60

                    return (
                      <tr key={enrollment.id}>
                        <td>{enrollment.student?.studentId}</td>
                        <td className="font-medium">{enrollment.student?.name}</td>
                        <td>{enrollment.class?.name}</td>
                        {isTeacher && (
                          <td>
                            <input
                              type="number"
                              className="input w-20"
                              min="0"
                              max="100"
                              value={scores.regularScore}
                              onChange={(e) =>
                                setGradeForm((prev) => ({
                                  ...prev,
                                  [enrollment.studentId]: {
                                    ...prev[enrollment.studentId],
                                    regularScore: parseInt(e.target.value) || 0,
                                  },
                                }))
                              }
                            />
                          </td>
                        )}
                        {isTeacher && (
                          <td>
                            <input
                              type="number"
                              className="input w-20"
                              min="0"
                              max="100"
                              value={scores.finalScore}
                              onChange={(e) =>
                                setGradeForm((prev) => ({
                                  ...prev,
                                  [enrollment.studentId]: {
                                    ...prev[enrollment.studentId],
                                    finalScore: parseInt(e.target.value) || 0,
                                  },
                                }))
                              }
                            />
                          </td>
                        )}
                        <td>
                          <span
                            className={`font-bold ${
                              isPassed ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {totalScore.toFixed(0)}
                          </span>
                        </td>
                        <td>
                          {grade?.totalScore !== undefined ? (
                            isPassed ? (
                              <span className="badge badge-green">已通过</span>
                            ) : (
                              <span className="badge badge-red">未通过</span>
                            )
                          ) : (
                            <span className="badge badge-gray">未录入</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
