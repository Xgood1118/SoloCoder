import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, Course } from '../types'
import { formatDate } from '../utils'

interface DashboardStats {
  totalStudents: number
  totalTeachers: number
  totalCourses: number
  totalClassrooms: number
  activeSemester: any
  lowEnrollmentCourses: Course[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get<ApiResponse<DashboardStats>>(
          '/reports/dashboard'
        )
        setStats(response.data.data!)
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!stats) {
    return <div className="text-center py-12">暂无数据</div>
  }

  const statCards = [
    { label: '学生总数', value: stats.totalStudents, icon: '👨‍🎓', color: 'bg-blue-500' },
    { label: '教师总数', value: stats.totalTeachers, icon: '👨‍🏫', color: 'bg-green-500' },
    { label: '课程总数', value: stats.totalCourses, icon: '📚', color: 'bg-purple-500' },
    { label: '教室总数', value: stats.totalClassrooms, icon: '🏫', color: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">仪表盘</h2>

      {stats.activeSemester && (
        <div className="card bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <h3 className="text-lg font-semibold mb-2">当前学期</h3>
          <p className="text-2xl font-bold">{stats.activeSemester.name}</p>
          <p className="text-sm opacity-90 mt-1">
            {formatDate(stats.activeSemester.startDate)} - {formatDate(stats.activeSemester.endDate)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="opacity-75">选课时间</p>
              <p>
                {formatDate(stats.activeSemester.courseSelectionStart)} -{' '}
                {formatDate(stats.activeSemester.courseSelectionEnd)}
              </p>
            </div>
            <div>
              <p className="opacity-75">成绩录入截止</p>
              <p>{formatDate(stats.activeSemester.gradeEntryDeadline)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{card.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div
                className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}
              >
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.lowEnrollmentCourses.length > 0 && (
        <div className="card border-l-4 border-yellow-500">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">⚠️</span>
            选课人数不足预警
          </h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>课程代码</th>
                  <th>授课教师</th>
                  <th>当前人数</th>
                  <th>最低人数</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.lowEnrollmentCourses.map((course) => (
                  <tr key={course.id}>
                    <td className="font-medium">{course.name}</td>
                    <td>{course.code}</td>
                    <td>{course.teacher?.name}</td>
                    <td>
                      <span className="text-red-600 font-semibold">
                        {course._count?.enrollments}
                      </span>
                    </td>
                    <td>{course.minStudents}</td>
                    <td>
                      <span className="badge badge-yellow">人数不足</span>
                    </td>
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
