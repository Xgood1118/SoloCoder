import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, Schedule, Course, Classroom, Semester, WeekDay } from '../types'
import { weekDayMap, periodTimeMap, formatDate } from '../utils'

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [filters, setFilters] = useState({
    semesterId: '',
    courseId: '',
    classroomId: '',
    dayOfWeek: '',
  })
  const [viewMode, setViewMode] = useState<'list' | 'timetable'>('timetable')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    courseId: '',
    classroomId: '',
    semesterId: '',
    dayOfWeek: WeekDay.MONDAY,
    startPeriod: 1,
    endPeriod: 2,
    startDate: '',
    endDate: '',
  })
  const [conflictResult, setConflictResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [checkingConflict, setCheckingConflict] = useState(false)

  const weekDays = Object.values(WeekDay)
  const periods = Array.from({ length: 12 }, (_, i) => i + 1)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          schedulesRes,
          coursesRes,
          classroomsRes,
          semestersRes,
        ] = await Promise.all([
          api.get<ApiResponse<Schedule[]>>('/schedules', { params: filters }),
          api.get<ApiResponse<Course[]>>('/courses'),
          api.get<ApiResponse<Classroom[]>>('/classrooms'),
          api.get<ApiResponse<Semester[]>>('/semesters'),
        ])

        setSchedules(schedulesRes.data.data || [])
        setCourses(coursesRes.data.data || [])
        setClassrooms(classroomsRes.data.data || [])
        setSemesters(semestersRes.data.data || [])

        const activeSemester = semestersRes.data.data?.find((s) => s.isActive)
        if (activeSemester) {
          setFilters((prev) => ({ ...prev, semesterId: activeSemester.id }))
          setFormData((prev) => ({
            ...prev,
            semesterId: activeSemester.id,
            startDate: activeSemester.startDate,
            endDate: activeSemester.endDate,
          }))
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [filters])

  const checkConflict = async () => {
    if (!formData.courseId || !formData.classroomId || !formData.semesterId) {
      alert('请先填写课程、教室和学期')
      return
    }

    setCheckingConflict(true)
    try {
      const response = await api.post<ApiResponse<any>>('/schedules/check-conflict', {
        ...formData,
      })
      setConflictResult(response.data.data)
    } catch (error: any) {
      alert(error.response?.data?.error || '冲突检测失败')
    } finally {
      setCheckingConflict(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await api.post<ApiResponse<Schedule>>('/schedules', formData)
      setShowModal(false)
      setConflictResult(null)
      setFormData({
        courseId: '',
        classroomId: '',
        semesterId: filters.semesterId,
        dayOfWeek: WeekDay.MONDAY,
        startPeriod: 1,
        endPeriod: 2,
        startDate: semesters.find((s) => s.id === filters.semesterId)?.startDate || '',
        endDate: semesters.find((s) => s.id === filters.semesterId)?.endDate || '',
      })

      const response = await api.get<ApiResponse<Schedule[]>>('/schedules', { params: filters })
      setSchedules(response.data.data || [])
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getScheduleForCell = (day: WeekDay, period: number) => {
    return schedules.filter(
      (s) => s.dayOfWeek === day && period >= s.startPeriod && period <= s.endPeriod
    )
  }

  const getRowSpan = (schedule: Schedule) => {
    return schedule.endPeriod - schedule.startPeriod + 1
  }

  const isFirstPeriodOfSchedule = (schedule: Schedule, period: number) => {
    return schedule.startPeriod === period
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">排课管理</h2>
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'timetable'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('timetable')}
            >
              周课表
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('list')}
            >
              列表视图
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + 新建排课
          </button>
        </div>
      </div>

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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程</label>
            <select
              className="select w-48"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">教室</label>
            <select
              className="select w-48"
              value={filters.classroomId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, classroomId: e.target.value }))
              }
            >
              <option value="">全部教室</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.building}-{c.roomNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">星期</label>
            <select
              className="select w-32"
              value={filters.dayOfWeek}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dayOfWeek: e.target.value }))
              }
            >
              <option value="">全部</option>
              {weekDays.map((d) => (
                <option key={d} value={d}>
                  {weekDayMap[d]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {viewMode === 'timetable' && (
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
                  <tr key={period} className="h-20">
                    <td className="border border-gray-200 p-2 text-center text-sm text-gray-600">
                      <div className="font-medium">第{period}节</div>
                      <div className="text-xs">{periodTimeMap[period]}</div>
                    </td>
                    {weekDays.map((day) => {
                      const cellSchedules = getScheduleForCell(day, period)
                      const renderedSchedules = cellSchedules.filter((s) =>
                        isFirstPeriodOfSchedule(s, period)
                      )
                      const coveredByOther = cellSchedules.some(
                        (s) => !isFirstPeriodOfSchedule(s, period)
                      )

                      if (coveredByOther && renderedSchedules.length === 0) {
                        return null
                      }

                      return (
                        <td
                          key={day}
                          className="border border-gray-200 p-1 align-top"
                          rowSpan={
                            renderedSchedules.length > 0
                              ? Math.max(...renderedSchedules.map((s) => getRowSpan(s)))
                              : 1
                          }
                        >
                          {renderedSchedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className={`p-2 rounded text-xs mb-1 ${
                                schedule.hasConflict
                                  ? 'bg-red-100 border border-red-300'
                                  : 'bg-blue-100 border border-blue-300'
                              }`}
                            >
                              <div className="font-medium text-gray-800">
                                {schedule.course?.name}
                              </div>
                              <div className="text-gray-600">
                                {schedule.course?.teacher?.name}
                              </div>
                              <div className="text-gray-600">
                                {schedule.classroom?.building}-{schedule.classroom?.roomNumber}
                              </div>
                              {schedule.hasConflict && (
                                <div className="text-red-600 font-medium mt-1">
                                  ⚠️ 有冲突
                                </div>
                              )}
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
        )}

        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>授课教师</th>
                  <th>教室</th>
                  <th>星期</th>
                  <th>节次</th>
                  <th>时间</th>
                  <th>有效期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="font-medium">{schedule.course?.name}</td>
                    <td>{schedule.course?.teacher?.name}</td>
                    <td>
                      {schedule.classroom?.building}-{schedule.classroom?.roomNumber}
                    </td>
                    <td>{weekDayMap[schedule.dayOfWeek]}</td>
                    <td>
                      第{schedule.startPeriod}-{schedule.endPeriod}节
                    </td>
                    <td>
                      {periodTimeMap[schedule.startPeriod]?.split('-')[0]}-
                      {periodTimeMap[schedule.endPeriod]?.split('-')[1]}
                    </td>
                    <td>
                      {formatDate(schedule.startDate)} ~ {formatDate(schedule.endDate)}
                    </td>
                    <td>
                      {schedule.hasConflict ? (
                        <span className="badge-red">冲突</span>
                      ) : schedule.conflictChecked ? (
                        <span className="badge-green">正常</span>
                      ) : (
                        <span className="badge-yellow">未检测</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="text-red-600 hover:text-red-800 text-sm"
                        onClick={async () => {
                          if (confirm('确定要删除该排课吗？')) {
                            await api.delete(`/schedules/${schedule.id}`)
                            const res = await api.get<ApiResponse<Schedule[]>>('/schedules', {
                              params: filters,
                            })
                            setSchedules(res.data.data || [])
                          }
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {schedules.length === 0 && (
          <div className="text-center py-12 text-gray-500">暂无排课数据</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">新建排课</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    课程 *
                  </label>
                  <select
                    className="select"
                    value={formData.courseId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, courseId: e.target.value }))
                    }
                    required
                  >
                    <option value="">请选择课程</option>
                    {courses
                      .filter((c) => c.semesterId === filters.semesterId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.teacher?.name})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    教室 *
                  </label>
                  <select
                    className="select"
                    value={formData.classroomId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, classroomId: e.target.value }))
                    }
                    required
                  >
                    <option value="">请选择教室</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.building}-{c.roomNumber} ({c.seatCount}座
                        {c.hasProjector ? '，有投影' : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    星期 *
                  </label>
                  <select
                    className="select"
                    value={formData.dayOfWeek}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dayOfWeek: e.target.value as WeekDay,
                      }))
                    }
                    required
                  >
                    {weekDays.map((d) => (
                      <option key={d} value={d}>
                        {weekDayMap[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      开始节次 *
                    </label>
                    <select
                      className="select"
                      value={formData.startPeriod}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          startPeriod: parseInt(e.target.value),
                        }))
                      }
                      required
                    >
                      {periods.map((p) => (
                        <option key={p} value={p}>
                          第{p}节
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      结束节次 *
                    </label>
                    <select
                      className="select"
                      value={formData.endPeriod}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          endPeriod: parseInt(e.target.value),
                        }))
                      }
                      required
                    >
                      {periods
                        .filter((p) => p >= formData.startPeriod)
                        .map((p) => (
                          <option key={p} value={p}>
                            第{p}节
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    开始日期 *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    结束日期 *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn btn-secondary mr-3"
                  onClick={checkConflict}
                  disabled={checkingConflict}
                >
                  {checkingConflict ? '检测中...' : '检测冲突'}
                </button>
              </div>

              {conflictResult && (
                <div
                  className={`p-4 rounded-lg ${
                    conflictResult.hasConflict ? 'bg-red-50' : 'bg-green-50'
                  }`}
                >
                  <div
                    className={`font-medium ${
                      conflictResult.hasConflict ? 'text-red-800' : 'text-green-800'
                    }`}
                  >
                    {conflictResult.hasConflict ? '⚠️ 检测到冲突' : '✅ 无冲突'}
                  </div>
                  {conflictResult.conflicts && conflictResult.conflicts.length > 0 && (
                    <div className="mt-2 text-sm text-red-700">
                      冲突详情：
                      <ul className="list-disc list-inside mt-1">
                        {conflictResult.conflicts.map((c: any, i: number) => (
                          <li key={i}>
                            {c.type === 'classroom'
                              ? `教室冲突：${c.existing.course?.name} 在 ${
                                  weekDayMap[c.existing.dayOfWeek]
                                } 第${c.existing.startPeriod}-${c.existing.endPeriod}节`
                              : `教师冲突：${c.existing.course?.name} 在 ${
                                  weekDayMap[c.existing.dayOfWeek]
                                } 第${c.existing.startPeriod}-${c.existing.endPeriod}节`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {conflictResult.availableClassrooms &&
                    conflictResult.availableClassrooms.length > 0 && (
                      <div className="mt-2 text-sm text-blue-700">
                        推荐可用教室：
                        <div className="flex flex-wrap gap-2 mt-1">
                          {conflictResult.availableClassrooms.map((c: any, i: number) => (
                            <button
                              key={i}
                              type="button"
                              className="px-2 py-1 bg-blue-100 rounded hover:bg-blue-200"
                              onClick={() =>
                                setFormData((prev) => ({ ...prev, classroomId: c.id }))
                              }
                            >
                              {c.building}-{c.roomNumber}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false)
                    setConflictResult(null)
                  }}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
