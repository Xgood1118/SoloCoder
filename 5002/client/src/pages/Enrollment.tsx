import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, Course, Enrollment as EnrollmentType, Semester, User } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { Role } from '../types'
import { formatDate, weekDayMap, periodTimeMap } from '../utils'

export default function Enrollment() {
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [myEnrollments, setMyEnrollments] = useState<EnrollmentType[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [filters, setFilters] = useState({
    semesterId: '',
    departmentId: '',
  })
  const [adminFilter, setAdminFilter] = useState({
    studentId: '',
    semesterId: '',
  })
  const [activeTab, setActiveTab] = useState<'available' | 'enrolled'>('available')
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [dropping, setDropping] = useState<string | null>(null)
  const [enrollmentStatus, setEnrollmentStatus] = useState<any>(null)

  const { user } = useAuthStore()
  const isAdmin = user?.role === Role.ADMIN

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [semestersRes, statusRes] = await Promise.all([
          api.get<ApiResponse<Semester[]>>('/semesters'),
          api.get<ApiResponse<any>>('/enrollment/status'),
        ])

        setSemesters(semestersRes.data.data || [])
        setEnrollmentStatus(statusRes.data.data)

        const activeSemester = semestersRes.data.data?.find((s) => s.isActive)
        if (activeSemester) {
          setFilters((prev) => ({ ...prev, semesterId: activeSemester.id }))
          setAdminFilter((prev) => ({ ...prev, semesterId: activeSemester.id }))
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
      fetchEnrollmentData()
    }
  }, [filters, activeTab])

  useEffect(() => {
    if (isAdmin && adminFilter.studentId && adminFilter.semesterId) {
      fetchStudentEnrollments()
    }
  }, [adminFilter, isAdmin])

  const fetchEnrollmentData = async () => {
    try {
      if (activeTab === 'available') {
        const response = await api.get<ApiResponse<Course[]>>('/enrollment/available', {
          params: { semesterId: filters.semesterId, departmentId: filters.departmentId },
        })
        setAvailableCourses(response.data.data || [])
      } else {
        const response = await api.get<ApiResponse<EnrollmentType[]>>('/enrollment/my', {
          params: { semesterId: filters.semesterId },
        })
        setMyEnrollments(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch enrollment data:', error)
    }
  }

  const fetchStudentEnrollments = async () => {
    try {
      const response = await api.get<ApiResponse<EnrollmentType[]>>('/enrollment/student', {
        params: { studentId: adminFilter.studentId, semesterId: adminFilter.semesterId },
      })
      setMyEnrollments(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch student enrollments:', error)
    }
  }

  const handleEnroll = async (courseId: string) => {
    if (!enrollmentStatus?.canEnroll) {
      alert('当前不在选课开放期内')
      return
    }

    setEnrolling(courseId)
    try {
      await api.post<ApiResponse<EnrollmentType>>('/enrollment/enroll', { courseId })
      alert('选课成功')
      fetchEnrollmentData()
    } catch (error: any) {
      alert(error.response?.data?.error || '选课失败')
    } finally {
      setEnrolling(null)
    }
  }

  const handleDrop = async (enrollmentId: string) => {
    if (!enrollmentStatus?.canDrop) {
      alert('当前不在退课开放期内')
      return
    }

    if (!confirm('确定要退选这门课程吗？')) return

    setDropping(enrollmentId)
    try {
      await api.post(`/enrollment/drop/${enrollmentId}`)
      alert('退课成功')
      fetchEnrollmentData()
      if (isAdmin && adminFilter.studentId) {
        fetchStudentEnrollments()
      }
    } catch (error: any) {
      alert(error.response?.data?.error || '退课失败')
    } finally {
      setDropping(null)
    }
  }

  const fetchStudents = async () => {
    try {
      const response = await api.get<ApiResponse<User[]>>('/students')
      setStudents(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch students:', error)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchStudents()
    }
  }, [isAdmin])

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">选课管理</h2>
        {enrollmentStatus && (
          <div
            className={`px-4 py-2 rounded-lg ${
              enrollmentStatus.canEnroll
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {enrollmentStatus.canEnroll ? (
              <span>✅ 选课开放中</span>
            ) : enrollmentStatus.currentSemester ? (
              <span>
                ⚠️ 选课期：{formatDate(enrollmentStatus.currentSemester.courseSelectionStart)} ~{' '}
                {formatDate(enrollmentStatus.currentSemester.courseSelectionEnd)}
              </span>
            ) : (
              <span>⚠️ 暂无可用学期</span>
            )}
          </div>
        )}
      </div>

      {isAdmin ? (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">查询学生选课情况</h3>
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
              <select
                className="select w-48"
                value={adminFilter.semesterId}
                onChange={(e) =>
                  setAdminFilter((prev) => ({ ...prev, semesterId: e.target.value }))
                }
              >
                <option value="">请选择学期</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isActive && '(当前)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学生</label>
              <select
                className="select w-48"
                value={adminFilter.studentId}
                onChange={(e) =>
                  setAdminFilter((prev) => ({ ...prev, studentId: e.target.value }))
                }
              >
                <option value="">请选择学生</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {myEnrollments.length > 0 && (
            <>
              <h4 className="font-medium text-gray-700 mb-3">已选课程</h4>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>课程名称</th>
                      <th>课程代码</th>
                      <th>学分</th>
                      <th>授课教师</th>
                      <th>选课时间</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {myEnrollments.map((enrollment) => (
                      <tr key={enrollment.id}>
                        <td className="font-medium">{enrollment.course?.name}</td>
                        <td>{enrollment.course?.code}</td>
                        <td>{enrollment.course?.credits}</td>
                        <td>{enrollment.course?.teacher?.name}</td>
                        <td>{formatDate(enrollment.enrolledAt)}</td>
                        <td>
                          <span
                            className={
                              enrollment.status === 'ENROLLED'
                                ? 'badge-green'
                                : 'badge-gray'
                            }
                          >
                            {enrollment.status === 'ENROLLED' ? '已选' : '已退'}
                          </span>
                        </td>
                        <td>
                          {enrollment.status === 'ENROLLED' && (
                            <button
                              className="text-red-600 hover:text-red-800 text-sm"
                              onClick={() => handleDrop(enrollment.id)}
                              disabled={dropping === enrollment.id}
                            >
                              {dropping === enrollment.id ? '处理中...' : '退课'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {myEnrollments.length === 0 && adminFilter.studentId && (
            <div className="text-center py-8 text-gray-500">该学生暂无选课记录</div>
          )}
        </div>
      ) : (
        <>
          <div className="flex border-b border-gray-200">
            <button
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('available')}
            >
              可选课程
            </button>
            <button
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'enrolled'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('enrolled')}
            >
              已选课程
            </button>
          </div>

          {activeTab === 'available' && (
            <div className="card">
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
                  <select
                    className="select w-48"
                    value={filters.semesterId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, semesterId: e.target.value }))
                    }
                  >
                    <option value="">全部学期</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isActive && '(当前)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableCourses.map((course) => (
                  <div
                    key={course.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-800">{course.name}</h4>
                        <p className="text-sm text-gray-500">{course.code}</p>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                        {course.credits}学分
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <p>教师：{course.teacher?.name}</p>
                      <p>
                        人数：
                        <span
                          className={`font-medium ${
                            (course._count?.enrollments || 0) >= course.maxStudents
                              ? 'text-red-600'
                              : (course._count?.enrollments || 0) < course.minStudents
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {course._count?.enrollments || 0}/{course.maxStudents}
                        </span>
                      </p>
                    </div>

                    {course.schedules && course.schedules.length > 0 && (
                      <div className="text-xs text-gray-500 mb-3">
                        {course.schedules.map((s, i) => (
                          <div key={i}>
                            {weekDayMap[s.dayOfWeek]} 第{s.startPeriod}-{s.endPeriod}节{' '}
                            {periodTimeMap[s.startPeriod]}
                            {s.classroom &&
                              ` (${s.classroom.building}-${s.classroom.roomNumber})`}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      className={`w-full py-2 rounded-lg font-medium transition-colors ${
                        (course._count?.enrollments || 0) >= course.maxStudents
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : enrollmentStatus?.canEnroll
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={() => handleEnroll(course.id)}
                      disabled={
                        (course._count?.enrollments || 0) >= course.maxStudents ||
                        !enrollmentStatus?.canEnroll ||
                        enrolling === course.id
                      }
                    >
                      {enrolling === course.id
                        ? '选课中...'
                        : (course._count?.enrollments || 0) >= course.maxStudents
                        ? '已满'
                        : enrollmentStatus?.canEnroll
                        ? '选课'
                        : '不在选课期'}
                    </button>
                  </div>
                ))}
              </div>

              {availableCourses.length === 0 && (
                <div className="text-center py-12 text-gray-500">暂无可选课程</div>
              )}
            </div>
          )}

          {activeTab === 'enrolled' && (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>课程名称</th>
                      <th>课程代码</th>
                      <th>学分</th>
                      <th>授课教师</th>
                      <th>上课时间</th>
                      <th>选课时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {myEnrollments.map((enrollment) => (
                      <tr key={enrollment.id}>
                        <td className="font-medium">{enrollment.course?.name}</td>
                        <td>{enrollment.course?.code}</td>
                        <td>{enrollment.course?.credits}</td>
                        <td>{enrollment.course?.teacher?.name}</td>
                        <td>
                          {enrollment.course?.schedules?.map((s, i) => (
                            <div key={i} className="text-sm">
                              {weekDayMap[s.dayOfWeek]} 第{s.startPeriod}-{s.endPeriod}节
                            </div>
                          ))}
                        </td>
                        <td>{formatDate(enrollment.enrolledAt)}</td>
                        <td>
                          <button
                            className="text-red-600 hover:text-red-800 text-sm"
                            onClick={() => handleDrop(enrollment.id)}
                            disabled={
                              !enrollmentStatus?.canDrop || dropping === enrollment.id
                            }
                          >
                            {dropping === enrollment.id
                              ? '处理中...'
                              : enrollmentStatus?.canDrop
                              ? '退课'
                              : '不在退课期'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {myEnrollments.length === 0 && (
                <div className="text-center py-12 text-gray-500">暂无已选课程</div>
              )}

              {myEnrollments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-gray-600">
                    已选 <span className="font-bold text-blue-600">{myEnrollments.length}</span> 门课程，
                    共{' '}
                    <span className="font-bold text-blue-600">
                      {myEnrollments.reduce(
                        (sum, e) => sum + (e.course?.credits || 0),
                        0
                      )}
                    </span>{' '}
                    学分
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
