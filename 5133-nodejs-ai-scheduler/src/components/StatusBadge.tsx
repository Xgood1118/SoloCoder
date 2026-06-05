import { Circle, CheckCircle2, XCircle, Clock, MinusCircle, Loader2 } from 'lucide-react'

type Status = 'running' | 'success' | 'failed' | 'timeout' | 'skipped' | 'pending'

interface StatusBadgeProps {
  status: Status
  label?: string
}

const statusConfig: Record<Status, { color: string; icon: typeof Circle; animate?: string }> = {
  running: { color: 'text-brand-cyan', icon: Loader2, animate: 'animate-spin' },
  success: { color: 'text-brand-green', icon: CheckCircle2 },
  failed: { color: 'text-brand-red', icon: XCircle },
  timeout: { color: 'text-brand-amber', icon: Clock },
  skipped: { color: 'text-brand-muted', icon: MinusCircle },
  pending: { color: 'text-yellow-400', icon: Circle },
}

const statusLabels: Record<Status, string> = {
  running: '运行中',
  success: '成功',
  failed: '失败',
  timeout: '超时',
  skipped: '已跳过',
  pending: '等待中',
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      {status === 'running' ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-cyan opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-cyan" />
        </span>
      ) : (
        <Icon className={`w-3.5 h-3.5 ${config.color} ${config.animate ?? ''}`} />
      )}
      <span className={config.color}>{label ?? statusLabels[status]}</span>
    </span>
  )
}
