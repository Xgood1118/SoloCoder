import { useEffect, useState } from 'react'
import { Bell, AlertTriangle, Clock, XCircle, RefreshCw, Check } from 'lucide-react'
import { useAlertStore } from '@/store/alertStore'
import type { AlertFilter } from '@/store/alertStore'

const typeIcons: Record<string, typeof Bell> = {
  timeout_warn: Clock,
  timeout_force: AlertTriangle,
  failure: XCircle,
  retry: RefreshCw,
  dependency_failed: XCircle,
}

const typeColors: Record<string, string> = {
  timeout_warn: 'text-brand-amber',
  timeout_force: 'text-brand-red',
  failure: 'text-brand-red',
  retry: 'text-brand-cyan',
  dependency_failed: 'text-brand-red',
}

const typeLabels: Record<string, string> = {
  timeout_warn: '超时警告',
  timeout_force: '强制超时',
  failure: '执行失败',
  retry: '重试',
  dependency_failed: '依赖失败',
}

export default function AlertList() {
  const { alerts, fetchAlerts, acknowledgeAlert } = useAlertStore()
  const [filter, setFilter] = useState<AlertFilter>({})

  useEffect(() => {
    fetchAlerts(filter)
  }, [filter, fetchAlerts])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-mono font-bold text-brand-text">告警中心</h1>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={filter.status ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
          className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="sent">已发送</option>
          <option value="acknowledged">已确认</option>
        </select>
        <select
          value={filter.type ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value || undefined }))}
          className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
        >
          <option value="">全部类型</option>
          <option value="timeout_warn">超时警告</option>
          <option value="timeout_force">强制超时</option>
          <option value="failure">执行失败</option>
          <option value="retry">重试</option>
          <option value="dependency_failed">依赖失败</option>
        </select>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-16 text-brand-muted">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无告警记录</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const Icon = typeIcons[alert.type] ?? Bell
            const color = typeColors[alert.type] ?? 'text-brand-muted'

            return (
              <div
                key={alert.id}
                className={`bg-brand-surface border rounded-xl p-4 flex items-start gap-4 ${
                  alert.status === 'pending'
                    ? 'border-brand-red/40'
                    : alert.status === 'acknowledged'
                    ? 'border-brand-border opacity-60'
                    : 'border-brand-border'
                }`}
              >
                <div className={`${color} mt-0.5`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-brand-text">{alert.taskName}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${color} bg-brand-bg`}>
                      {typeLabels[alert.type] ?? alert.type}
                    </span>
                  </div>
                  <p className="text-xs text-brand-muted">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-brand-muted font-mono">
                    <span>{new Date(alert.createdAt).toLocaleString('zh-CN')}</span>
                    <span>渠道: {alert.channels.join(', ')}</span>
                  </div>
                </div>
                {alert.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-brand-green border border-brand-green/30 rounded-lg hover:bg-brand-green/10 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    确认
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
