import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, CourseReport, AttendanceReport, Course, Semester, Class, WeekDay } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { Role } from '../types'
import { formatDate, weekDayMap } from '../utils'

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'course' | 'attendance' | 'timetable'>('course')
  const [courseReports, setCourseReports] = useState<CourseReport[]>([])
  const [attendanceReports, setAttendanceReports] = useState<AttendanceReport[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [filters, setFilters] = useState({
    semesterId: '',
    courseId: '',
    classId: '',
    month: '',
  })
  const [timetableData, setTimetableData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const { user } = useAuthStore()
  const isTeacher = user?.role === Role.TEACHER
  const isCounselor = user?.role === Role.COUNSELOR
  const isAdmin = user?.role === Role.ADMIN

  const weekDays = Object.values(WeekDay)
  const periods = Array.from({ length: 12 }, (_, i) => i + 1)

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
      if (isAdmin || isTeacher) {
        fetchCourses()
      }
      if (isAdmin || isCounselor) {
        fetchClasses()
      }
    }
  }, [filters.semesterId])

  useEffect(() => {
    if (activeTab === 'course' && filters.semesterId) {
      fetchCourseReports()
    } else if (activeTab === 'attendance' && filters.classId && filters.month) {
      fetchAttendanceReports()
    } else if (activeTab === 'timetable' && filters.semesterId) {
      fetchTimetable()
    }
  }, [activeTab, filters])

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

  const fetchClasses = async () => {
    try {
      let endpoint = '/classes'
      if (isCounselor) {
        endpoint = '/classes/my'
      }
      const response = await api.get<ApiResponse<Class[]>>(endpoint)
      setClasses(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch classes:', error)
    }
  }

  const fetchCourseReports = async () => {
    try {
      const params: any = { semesterId: filters.semesterId }
      if (filters.courseId) {
        params.courseId = filters.courseId
      }
      const response = await api.get<ApiResponse<CourseReport[]>>('/reports/course', { params })
      setCourseReports(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch course reports:', error)
    }
  }

  const fetchAttendanceReports = async () => {
    try {
      const response = await api.get<ApiResponse<AttendanceReport[]>>('/reports/attendance', {
        params: { classId: filters.classId, month: filters.month },
      })
      setAttendanceReports(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch attendance reports:', error)
    }
  }

  const fetchTimetable = async () => {
    try {
      const response = await api.get<ApiResponse<any>>('/reports/timetable', {
        params: { semesterId: filters.semesterId },
      })
      setTimetableData(response.data.data)
    } catch (error) {
      console.error('Failed to fetch timetable:', error)
    }
  }

  const generateCourseReport = async (courseId: string) => {
    setGenerating(true)
    try {
      await api.post(`/reports/course/${courseId}`)
      alert('报告生成成功')
      fetchCourseReports()
    } catch (error: any) {
      alert(error.response?.data?.error || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const generateAttendanceReport = async () => {
    if (!filters.classId || !filters.month) {
      alert('请选择班级和月份')
      return
    }
    setGenerating(true)
    try {
      await api.post('/reports/attendance', {
        classId: filters.classId,
        month: filters.month,
      })
      alert('报告生成成功')
      fetchAttendanceReports()
    } catch (error: any) {
      alert(error.response?.data?.error || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const getScoreDistribution = (distributionStr: string) => {
    try {
      return JSON.parse(distributionStr)
    } catch {
      return {}
    }
  }

  const getSchedulesForCell = (day: WeekDay, period: number) => {
    if (!timetableData?.schedules) return []
    return timetableData.schedules.filter(
      (s: any) => s.dayOfWeek === day && period >= s.startPeriod && period <= s.endPeriod
    )
  }

  const isFirstPeriod = (schedule: any, period: number) => {
    return schedule.startPeriod === period
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">报表中心</h2>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'course'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('course')}
        >
          课程教学总结
        </button>
        <button
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'attendance'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('attendance')}
        >
          考勤报表
        </button>
        <button
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'timetable'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('timetable')}
        >
          教室周课表
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
          <select
            className="select w-48"
            value={filters.semesterId}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, semesterId: e.target.value }))
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

        {activeTab === 'course' && (isAdmin || isTeacher) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程</label>
            <select
              className="select w-64"
              value={filters.courseId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, courseId: e.target.value }))
              }
            >
              <option value="">全部课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'attendance' && (isAdmin || isCounselor) && (
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

      {activeTab === 'course' && (
        <div className="card">
          {isAdmin && (
            <div className="mb-4 flex justify-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (courses.length > 0) {
                    generateCourseReport(courses[0].id)
                  }
                }}
                disabled={generating || courses.length === 0}
              >
                {generating ? '生成中...' : '生成课程报告'}
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>授课教师</th>
                  <th>学期</th>
                  <th>选课人数</th>
                  <th>平均出勤率</th>
                  <th>平均分</th>
                  <th>及格率</th>
                  <th>生成时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {courseReports.map((report) => {
                  const distribution = getScoreDistribution(report.scoreDistribution)
                  return (
                    <tr key={report.id}>
                      <td className="font-medium">{report.course?.name}</td>
                      <td>{report.course?.teacher?.name}</td>
                      <td>{report.course?.semester?.name}</td>
                      <td>{report.totalStudents}</td>
                      <td>
                        <span
                          className={
                            report.avgAttendance >= 90
                              ? 'text-green-600'
                              : report.avgAttendance >= 70
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {report.avgAttendance.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            report.avgScore >= 80
                              ? 'text-green-600'
                              : report.avgScore >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {report.avgScore.toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            report.passRate >= 90
                              ? 'text-green-600'
                              : report.passRate >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {report.passRate.toFixed(1)}%
                        </span>
                      </td>
                      <td>{formatDate(report.generatedAt)}</td>
                      <td>
                        {isTeacher && (
                          <button
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            onClick={() => generateCourseReport(report.courseId)}
                            disabled={generating}
                          >
                            重新生成
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {courseReports.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-semibold mb-4">成绩分布统计</h4>
              <div className="grid grid-cols-5 gap-4">
                {['90-100', '80-89', '70-79', '60-69', '0-59'].map((range) => {
                  const total = courseReports.reduce(
                    (sum, r) => sum + (getScoreDistribution(r.scoreDistribution)[range] || 0),
                    0
                  )
                  const totalStudents = courseReports.reduce(
                    (sum, r) => sum + r.totalStudents,
                    0
                  )
                  const percentage = totalStudents > 0 ? (total / totalStudents) * 100 : 0
                  const colors: Record<string, string> = {
                    '90-100': 'bg-green-500',
                    '80-89': 'bg-blue-500',
                    '70-79': 'bg-yellow-500',
                    '60-69': 'bg-orange-500',
                    '0-59': 'bg-red-500',
                  }
                  return (
                    <div key={range} className="text-center">
                      <div className="text-sm text-gray-500 mb-1">{range}分</div>
                      <div className="relative h-24 bg-gray-100 rounded">
                        <div
                          className={`absolute bottom-0 left-0 right-0 ${colors[range]} rounded`}
                          style={{ height: `${percentage}%` }}
                        />
                      </div>
                      <div className="mt-2 font-bold">{total}人</div>
                      <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {courseReports.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无课程报告数据</div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (isAdmin || isCounselor) && (
        <div className="card">
          <div className="mb-4 flex justify-end">
            <button
              className="btn btn-primary"
              onClick={generateAttendanceReport}
              disabled={generating || !filters.classId || !filters.month}
            >
              {generating ? '生成中...' : '生成考勤报表'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>学生姓名</th>
                  <th>学号</th>
                  <th>班级</th>
                  <th>月份</th>
                  <th>应到次数</th>
                  <th>出勤</th>
                  <th>缺勤</th>
                  <th>迟到</th>
                  <th>出勤率</th>
                  <th>生成时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendanceReports.map((report) => (
                  <tr key={report.id}>
                    <td className="font-medium">{report.student?.name}</td>
                    <td>{report.student?.studentId}</td>
                    <td>{report.class?.name}</td>
                    <td>{report.month}</td>
                    <td>{report.totalClasses}</td>
                    <td className="text-green-600">{report.presentCount}</td>
                    <td className="text-red-600">{report.absentCount}</td>
                    <td className="text-yellow-600">{report.lateCount}</td>
                    <td>
                      <span
                        className={
                          report.attendanceRate >= 90
                            ? 'text-green-600'
                            : report.attendanceRate >= 70
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }
                      >
                        {report.attendanceRate.toFixed(1)}%
                      </span>
                    </td>
                    <td>{formatDate(report.generatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {attendanceReports.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-semibold mb-4">考勤汇总</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">总应到次数</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {attendanceReports.reduce((sum, r) => sum + r.totalClasses, 0)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">出勤次数</p>
                  <p className="text-2xl font-bold text-green-600">
                    {attendanceReports.reduce((sum, r) => sum + r.presentCount, 0)}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">缺勤次数</p>
                  <p className="text-2xl font-bold text-red-600">
                    {attendanceReports.reduce((sum, r) => sum + r.absentCount, 0)}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">平均出勤率</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {attendanceReports.length > 0
                      ? (
                          attendanceReports.reduce((sum, r) => sum + r.attendanceRate, 0) /
                          attendanceReports.length
                        ).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </div>
          )}

          {attendanceReports.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无考勤报表数据</div>
          )}
        </div>
      )}

      {activeTab === 'timetable' && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            {timetableData?.classroom?.building}-{timetableData?.classroom?.roomNumber} 周课表
          </h3>

          {timetableData?.classrooms && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">选择教室</label>
              <select
                className="select w-48"
                onChange={(e) => {
                  if (e.target.value) {
                    api
                      .get<ApiResponse<any>>('/reports/timetable', {
                        params: {
                          semesterId: filters.semesterId,
                          classroomId: e.target.value,
                        },
                      })
                      .then((res) => setTimetableData(res.data.data))
                  }
                }}
              >
                {timetableData.classrooms.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.building}-{c.roomNumber} ({c.seatCount}座)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="table-fixed w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="w-20 border border-gray-200 p-2">节次</th>
                  {weekDays.map((day) => (
                    <th key={day} className="border border-gray-200 p-2">
                      {weekDayMap[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period} className="h-16">
                    <td className="border border-gray-200 p-2 text-center text-sm text-gray-600">
                      <div className="font-medium">第{period}节</div>
                    </td>
                    {weekDays.map((day) => {
                      const cellSchedules = getSchedulesForCell(day, period)
                      const rendered = cellSchedules.filter((s: any) => isFirstPeriod(s, period))
                      const covered = cellSchedules.some((s: any) => !isFirstPeriod(s, period))

                      if (covered && rendered.length === 0) return null

                      return (
                        <td
                          key={day}
                          className="border border-gray-200 p-1 align-top"
                          rowSpan={
                            rendered.length > 0
                              ? Math.max(
                                  ...rendered.map(
                                    (s: any) => s.endPeriod - s.startPeriod + 1
                                  )
                                )
                              : 1
                          }
                        >
                          {rendered.map((schedule: any) => (
                            <div
                              key={schedule.id}
                              className="p-2 rounded text-xs bg-blue-100 border border-blue-300"
                            >
                              <div className="font-medium text-gray-800">
                                {schedule.course?.name}
                              </div>
                              <div className="text-gray-600">
                                {schedule.course?.teacher?.name}
                              </div>
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
