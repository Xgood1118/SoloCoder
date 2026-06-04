import { Clock } from 'lucide-react'

interface DurationBadgeProps {
  minutes: number
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`
  }

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60

  if (minutes <= 120) {
    return remaining === 0 ? `${hours}小时` : `${hours}小时${remaining}分钟`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24

  if (remainingHours === 0) {
    return `${days}天`
  }
  return `${days}天${remainingHours}小时`
}

export default function DurationBadge({ minutes }: DurationBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-600">
      <Clock size={12} />
      {formatDuration(minutes)}
    </span>
  )
}
