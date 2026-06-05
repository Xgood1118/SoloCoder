import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, ListTodo, ScrollText, Bell, Settings, Activity, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import { useEffect } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/tasks', icon: ListTodo, label: '任务管理' },
  { to: '/records', icon: ScrollText, label: '执行记录' },
  { to: '/alerts', icon: Bell, label: '告警中心' },
  { to: '/settings', icon: Settings, label: '系统设置' },
]

export default function Layout() {
  const location = useLocation()
  const { stats, fetchStats } = useDashboardStore()

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen bg-brand-bg">
      <aside className="w-60 flex-shrink-0 bg-brand-surface border-r border-brand-border flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-brand-border">
          <Activity className="w-6 h-6 text-brand-cyan mr-2" />
          <span className="font-mono font-bold text-lg text-brand-cyan text-glow-cyan">
            TaskScheduler
          </span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.to)
                    ? 'bg-brand-cyan/10 text-brand-cyan glow-cyan'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-border/30'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <div className="text-xs text-brand-muted font-mono">
            SYSTEM v1.0.0
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-brand-surface border-b border-brand-border">
          <div className="flex items-center gap-4">
            <span className="text-brand-muted text-sm font-mono">
              {new Date().toLocaleDateString('zh-CN')}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-brand-cyan" />
              <span className="text-brand-muted">运行中</span>
              <span className="font-mono font-bold text-brand-cyan">
                {stats?.runningTasks ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-brand-amber" />
              <span className="text-brand-muted">待处理</span>
              <span className="font-mono font-bold text-brand-amber">
                {stats?.pendingAlerts ?? 0}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto grid-pattern">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
