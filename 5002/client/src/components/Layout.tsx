import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { Role } from '../types'
import { roleMap, formatDate } from '../utils'
import api from '../lib/axios'
import { ApiResponse } from '../types'

interface LayoutProps {
  children: ReactNode
}

interface MenuItem {
  path: string
  label: string
  icon: string
  roles: Role[]
}

const menuItems: MenuItem[] = [
  { path: '/dashboard', label: '仪表盘', icon: '📊', roles: [Role.ADMIN, Role.ACADEMIC_SECRETARY] },
  { path: '/courses', label: '课程管理', icon: '📚', roles: [Role.ADMIN, Role.TEACHER, Role.ACADEMIC_SECRETARY] },
  { path: '/schedules', label: '排课管理', icon: '📅', roles: [Role.ADMIN, Role.ACADEMIC_SECRETARY] },
  { path: '/enrollment', label: '选课管理', icon: '✏️', roles: [Role.STUDENT, Role.ADMIN] },
  { path: '/grades', label: '成绩管理', icon: '📝', roles: [Role.TEACHER, Role.STUDENT, Role.ADMIN] },
  { path: '/attendance', label: '考勤管理', icon: '✅', roles: [Role.TEACHER, Role.STUDENT, Role.COUNSELOR, Role.ADMIN] },
  { path: '/resources', label: '资源管理', icon: '🏫', roles: [Role.ADMIN, Role.ACADEMIC_SECRETARY] },
  { path: '/reports', label: '报表中心', icon: '📈', roles: [Role.ADMIN, Role.TEACHER, Role.COUNSELOR] },
  { path: '/notifications', label: '通知中心', icon: '🔔', roles: Object.values(Role) },
]

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const filteredMenuItems = menuItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  )

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get<ApiResponse<{ count: number }>>(
          '/notifications/unread-count'
        )
        setUnreadCount(response.data.data?.count || 0)
      } catch (error) {
        console.error('Failed to fetch unread count:', error)
      }
    }

    if (user) {
      fetchUnreadCount()
      const interval = setInterval(fetchUnreadCount, 60000)
      return () => clearInterval(interval)
    }
  }, [user])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
            <h1 className="text-xl font-bold text-gray-800">教务管理系统</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/notifications"
              className="relative p-2 rounded-md hover:bg-gray-100"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-800">{user.name}</p>
                <p className={`text-xs px-2 py-0.5 rounded ${user.role === Role.ADMIN ? 'bg-red-100 text-red-800' : user.role === Role.TEACHER ? 'bg-blue-100 text-blue-800' : user.role === Role.STUDENT ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                  {roleMap[user.role]}
                </p>
              </div>
              <button
                onClick={logout}
                className="btn btn-secondary text-sm"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        <aside
          className={`fixed left-0 top-16 bottom-0 bg-white shadow-lg transition-all duration-300 z-40 ${
            sidebarOpen ? 'w-56' : 'w-16'
          }`}
        >
          <nav className="p-4 space-y-2">
            {filteredMenuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                {sidebarOpen && item.path === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? 'ml-56' : 'ml-16'
          } p-6`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
