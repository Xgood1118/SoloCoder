import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center')}>
      {icon && <div className="mb-4 text-warm-muted">{icon}</div>}
      <h3 className="text-lg font-semibold text-warm-brown">{title}</h3>
      {description && <p className="mt-2 text-sm text-warm-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
