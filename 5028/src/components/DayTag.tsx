import { cn } from '@/lib/utils'

interface DayTagProps {
  date: string
  dayNumber: number
  active?: boolean
  onClick?: () => void
}

function formatDate(date: string): string {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function DayTag({ date, dayNumber, active = false, onClick }: DayTagProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex flex-col items-center rounded-xl px-4 py-2 text-center transition-colors duration-200',
        active
          ? 'bg-coral-500 text-white'
          : 'bg-ocean-50 text-ocean-600'
      )}
    >
      <span className="text-xs font-medium">第{dayNumber}天</span>
      <span className="text-xs opacity-75">{formatDate(date)}</span>
    </button>
  )
}
