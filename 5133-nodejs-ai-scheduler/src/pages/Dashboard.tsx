import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTodo, Activity, TrendingUp, AlertTriangle, Plus, Play } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import { useAlertStore } from '@/store/alertStore'
import StatCard from '@/components/StatCard'
import StatusBadge from '@/components/StatusBadge'

export default function Dashboard() {
  const navigate = useNavigate()
  const { stats, fetchStats } = useDashboardStore()
  const { alerts, fetchAlerts } = useAlertStore()

  useEffect(() => {
    fetchStats()
    fetchAlerts({ status: 'pending' })
  }, [fetchStats, fetchAlerts])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-mono font-bold text-brand-text">仪表盘</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/tasks/create')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 rounded-lg text-sm font-mono hover:bg-brand-cyan/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建任务
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="任务总数"
          value={stats?.totalTasks ?? 0}
          icon={ListTodo}
          color="cyan"
        />
        <StatCard
          title="运行中"
          value={stats?.runningTasks ?? 0}
          icon={Activity}
          color="green"
        />
        <StatCard
          title="成功率"
          value={`${(stats?.successRate ?? 0).toFixed(1)}%`}
          icon={TrendingUp}
          color="green"
          trend={stats && stats.successRate >= 95 ? '优秀' : stats && stats.successRate >= 80 ? '良好' : '需关注'}
        />
        <StatCard
          title="待处理告警"
          value={stats?.pendingAlerts ?? 0}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className="text-sm font-mono font-bold text-brand-text mb-4">近期执行</h2>
          <div className="space-y-3">
            {(stats?.recentExecutions ?? []).length === 0 ? (
              <div className="text-brand-muted text-sm text-center py-8">暂无执行记录</div>
            ) : (
              (stats?.recentExecutions ?? []).map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between px-4 py-3 bg-brand-bg/50 rounded-lg border border-brand-border/50 hover:border-brand-cyan/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/records/${exec.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-brand-cyan/30 rounded-full" />
                    <div>
                      <div className="text-sm font-mono text-brand-text">{exec.taskName}</div>
                      <div className="text-xs text-brand-muted">
                        {new Date(exec.triggerTime).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {exec.durationMs != null && (
                      <span className="text-xs font-mono text-brand-muted">
                        {(exec.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    <StatusBadge status={exec.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono font-bold text-brand-text">待处理告警</h2>
            <button
              type="button"
              onClick={() => navigate('/alerts')}
              className="text-xs text-brand-cyan hover:underline font-mono"
            >
              查看全部
            </button>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-brand-muted text-sm text-center py-8">暂无告警</div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`px-4 py-3 rounded-lg border-l-4 ${
                    alert.type.includes('timeout')
                      ? 'border-l-brand-amber bg-brand-amber/5'
                      : 'border-l-brand-red bg-brand-red/5'
                  }`}
                >
                  <div className="text-xs font-mono text-brand-text">{alert.taskName}</div>
                  <div className="text-[11px] text-brand-muted mt-1">{alert.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
