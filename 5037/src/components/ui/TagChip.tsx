import { cn } from '@/lib/utils'

interface TagChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  icon?: string
}

export default function TagChip({ label, active = false, onClick, icon }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-3 py-1 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-500 text-white'
          : 'bg-warm-gray text-warm-brown'
      )}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  )
}
