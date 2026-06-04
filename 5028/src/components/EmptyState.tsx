import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4 text-ocean-300">{icon}</div>
      <h3 className="font-serif text-lg font-semibold text-ocean-800">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-ocean-400 max-w-xs">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-primary mt-6 text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
