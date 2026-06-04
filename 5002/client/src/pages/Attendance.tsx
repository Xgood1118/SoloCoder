import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, Course, Schedule, Attendance as AttendanceType, User, Class, Semester, AttendanceStatus, WeekDay } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { Role } from '../types'
import { formatDate, weekDayMap, attendanceStatusMap } from '../utils'

export default function Attendance() {
  const [courses, setCourses] = useState<Course[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [attendances, setAttendances] = useState<AttendanceType[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [filters, setFilters] = useState({
    semesterId: '',
    classId: '',
    month: '',
  })
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { user } = useAuthStore()
  const isTeacher = user?.role === Role.TEACHER
  const isStudent = user?.role === Role.STUDENT
  const isCounselor = user?.role === Role.COUNSELOR
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

        const currentMonth = new Date()
        setFilters((prev) => ({
          ...prev,
          month: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`,
        }))
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
      if (isTeacher) {
        fetchTeacherCourses()
      }
      if (isCounselor) {
        fetchCounselorClasses()
      }
      if (isAdmin) {
        fetchAllCourses()
        fetchAllClasses()
      }
    }
  }, [filters.semesterId])

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseSchedules()
    }
  }, [selectedCourse])

  useEffect(() => {
    if (selectedSchedule && attendanceDate) {
      fetchAttendanceRecords()
    }
  }, [selectedSchedule, attendanceDate])

  useEffect(() => {
    if (isStudent && filters.semesterId) {
      fetchMyAttendance()
    }
    if ((isCounselor || isAdmin) && filters.classId && filters.month) {
      fetchClassAttendanceReport()
    }
  }, [filters])

  const fetchTeacherCourses = async () => {
    try {
      const response = await api.get<ApiResponse<Course[]>>('/courses/my', {
        params: { semesterId: filters.semesterId },
      })
      setCourses(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const fetchAllCourses = async () => {
    try {
      const response = await api.get<ApiResponse<Course[]>>('/courses', {
        params: { semesterId: filters.semesterId },
      })
      setCourses(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const fetchCounselorClasses = async () => {
    try {
      const response = await api.get<ApiResponse<Class[]>>('/classes/my')
      setClasses(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch classes:', error)
    }
  }

  const fetchAllClasses = async () => {
    try {
      const response = await api.get<ApiResponse<Class[]>>('/classes')
      setClasses(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch classes:', error)
    }
  }

  const fetchCourseSchedules = async () => {
    try {
      const response = await api.get<ApiResponse<Schedule[]>>('/schedules', {
        params: { courseId: selectedCourse!.id },
      })
      setSchedules(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch schedules:', error)
    }
  }

  const fetchAttendanceRecords = async () => {
    try {
      const response = await api.get<ApiResponse<AttendanceType[]>>('/attendance', {
        params: {
          scheduleId: selectedSchedule!.id,
          date: attendanceDate,
        },
      })
      const records = response.data.data || []
      setAttendances(records)

      const initialData: Record<string, AttendanceStatus> = {}
      records.forEach((r) => {
        initialData[r.studentId] = r.status
      })

      const enrollments = selectedCourse?._count?.enrollments || 0
      if (records.length === 0 && enrollments > 0) {
        const enrollmentsRes = await api.get<ApiResponse<any[]>>('/enrollments', {
          params: { courseId: selectedCourse!.id },
        })
        enrollmentsRes.data.data?.forEach((e) => {
          initialData[e.studentId] = AttendanceStatus.PRESENT
        })
        setAttendances(
          enrollmentsRes.data.data?.map((e) => ({
            id: '',
            scheduleId: selectedSchedule?.id || '',
            studentId: e.studentId,
            enrollmentId: e.id,
            date: attendanceDate,
            student: e.student,
            status: AttendanceStatus.PRESENT,
          })) || []
        )
      }

      setAttendanceData(initialData)
    } catch (error) {
      console.error('Failed to fetch attendance records:', error)
    }
  }

  const fetchMyAttendance = async () => {
    try {
      const response = await api.get<ApiResponse<AttendanceType[]>>('/attendance/my', {
        params: { semesterId: filters.semesterId },
      })
      setAttendances(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch my attendance:', error)
    }
  }

  const fetchClassAttendanceReport = async () => {
    try {
      const response = await api.get<ApiResponse<AttendanceType[]>>('/attendance/class', {
        params: {
          classId: filters.classId,
          month: filters.month,
        },
      })
      setAttendances(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch class attendance:', error)
    }
  }

  const handleSubmitAttendance = async () => {
    if (!selectedSchedule) return

    const attendanceEntries = Object.entries(attendanceData).map(([studentId, status]) => ({
      studentId,
      scheduleId: selectedSchedule.id,
      date: attendanceDate,
      status,
    }))

    setSubmitting(true)
    try {
      await api.post('/attendance/batch', { attendances: attendanceEntries })
      alert('考勤提交成功')
      fetchAttendanceRecords()
    } catch (error: any) {
      alert(error.response?.data?.error || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getAttendanceStats = () => {
    const stats = {
      total: attendances.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    }
    attendances.forEach((a) => {
      if (a.status === AttendanceStatus.PRESENT) stats.present++
      else if (a.status === AttendanceStatus.ABSENT) stats.absent++
      else if (a.status === AttendanceStatus.LATE) stats.late++
      else if (a.status === AttendanceStatus.EXCUSED) stats.excused++
    })
    return stats
  }

  const stats = getAttendanceStats()

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">考勤管理</h2>
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
              setSelectedSchedule(null)
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

        {(isTeacher || isAdmin) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程</label>
            <select
              className="select w-64"
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const course = courses.find((c) => c.id === e.target.value)
                setSelectedCourse(course || null)
                setSelectedSchedule(null)
              }}
            >
              <option value="">请选择课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedCourse && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课次</label>
            <select
              className="select w-48"
              value={selectedSchedule?.id || ''}
              onChange={(e) => {
                const schedule = schedules.find((s) => s.id === e.target.value)
                setSelectedSchedule(schedule || null)
              }}
            >
              <option value="">请选择课次</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {weekDayMap[s.dayOfWeek]} 第{s.startPeriod}-{s.endPeriod}节
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedSchedule && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              className="input w-40"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>
        )}

        {(isCounselor || isAdmin) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">班级</label>
              <select
                className="select w-48"
                value={filters.classId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, classId: e.target.value }))
                }
              >
                <option value="">请选择班级</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">月份</label>
              <input
                type="month"
                className="input w-40"
                value={filters.month}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, month: e.target.value }))
                }
              />
            </div>
          </>
        )}
      </div>

      {(isTeacher || isAdmin) && selectedSchedule && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">{selectedCourse?.name} - 考勤记录</h3>
              <p className="text-sm text-gray-500">
                {weekDayMap[selectedSchedule.dayOfWeek]} 第{selectedSchedule.startPeriod}-
                {selectedSchedule.endPeriod}节 | {formatDate(attendanceDate)}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSubmitAttendance}
              disabled={submitting}
            >
              {submitting ? '提交中...' : '提交考勤'}
            </button>
          </div>

          {attendances.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">应到人数</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">出勤</p>
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">缺勤</p>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">迟到/请假</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.late + stats.excused}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>学生姓名</th>
                  <th>考勤状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendances.map((attendance) => (
                  <tr key={attendance.id || attendance.studentId}>
                    <td>{attendance.student?.studentId}</td>
                    <td className="font-medium">{attendance.student?.name}</td>
                    <td>
                      <select
                        className="select w-32"
                        value={attendanceData[attendance.studentId] || AttendanceStatus.PRESENT}
                        onChange={(e) =>
                          setAttendanceData((prev) => ({
                            ...prev,
                            [attendance.studentId]: e.target.value as AttendanceStatus,
                          }))
                        }
                      >
                        {Object.values(AttendanceStatus).map((status) => (
                          <option key={status} value={status}>
                            {attendanceStatusMap[status].label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {attendances.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无学生数据</div>
          )}
        </div>
      )}

      {isStudent && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>课程名称</th>
                  <th>课次</th>
                  <th>状态</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendances.map((attendance) => (
                  <tr key={attendance.id}>
                    <td>{formatDate(attendance.date)}</td>
                    <td className="font-medium">{attendance.schedule?.course?.name}</td>
                    <td>
                      {attendance.schedule &&
                        `${weekDayMap[attendance.schedule.dayOfWeek]} 第${attendance.schedule.startPeriod}-${attendance.schedule.endPeriod}节`}
                    </td>
                    <td>
                      <span className={attendanceStatusMap[attendance.status].className}>
                        {attendanceStatusMap[attendance.status].label}
                      </span>
                    </td>
                    <td className="text-gray-500">{attendance.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {attendances.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无考勤记录</div>
          )}

          {attendances.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">总考勤次数</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">出勤率</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.total > 0
                    ? Math.round((stats.present / stats.total) * 100)
                    : 0}
                  %
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">缺勤次数</p>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">迟到/请假</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.late + stats.excused}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {(isCounselor || isAdmin) && filters.classId && filters.month && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            {classes.find((c) => c.id === filters.classId)?.name} - {filters.month} 考勤报表
          </h3>

          {attendances.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">总考勤记录</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">出勤</p>
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">缺勤</p>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">迟到/请假</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.late + stats.excused}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>学生姓名</th>
                  <th>学号</th>
                  <th>日期</th>
                  <th>课程</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendances.map((attendance) => (
                  <tr key={attendance.id}>
                    <td className="font-medium">{attendance.student?.name}</td>
                    <td>{attendance.student?.studentId}</td>
                    <td>{formatDate(attendance.date)}</td>
                    <td>{attendance.schedule?.course?.name}</td>
                    <td>
                      <span className={attendanceStatusMap[attendance.status].className}>
                        {attendanceStatusMap[attendance.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {attendances.length === 0 && (
            <div className="text-center py-12 text-gray-500">该月暂无考勤记录</div>
          )}
        </div>
      )}
    </div>
  )
}
