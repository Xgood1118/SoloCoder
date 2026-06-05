import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: 'cyan' | 'amber' | 'red' | 'green'
  trend?: string
}

const colorMap = {
  cyan: {
    text: 'text-brand-cyan',
    bg: 'from-brand-cyan/10 to-brand-surface',
    glow: 'glow-cyan',
    textGlow: 'text-glow-cyan',
    iconBg: 'bg-brand-cyan/10',
  },
  amber: {
    text: 'text-brand-amber',
    bg: 'from-brand-amber/10 to-brand-surface',
    glow: 'glow-amber',
    textGlow: 'text-glow-amber',
    iconBg: 'bg-brand-amber/10',
  },
  red: {
    text: 'text-brand-red',
    bg: 'from-brand-red/10 to-brand-surface',
    glow: 'glow-red',
    textGlow: 'text-glow-red',
    iconBg: 'bg-brand-red/10',
  },
  green: {
    text: 'text-brand-green',
    bg: 'from-brand-green/10 to-brand-surface',
    glow: 'glow-green',
    textGlow: 'text-glow-green',
    iconBg: 'bg-brand-green/10',
  },
}

export default function StatCard({ title, value, icon: Icon, color, trend }: StatCardProps) {
  const c = colorMap[color]

  return (
    <div className={`relative bg-gradient-to-br ${c.bg} border border-brand-border rounded-xl p-5 ${c.glow}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-brand-muted text-xs font-medium uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className={`text-3xl font-mono font-bold ${c.text} ${c.textGlow}`}>
            {value}
          </p>
          {trend && (
            <p className="text-xs text-brand-muted mt-1">{trend}</p>
          )}
        </div>
        <div className={`${c.iconBg} p-2.5 rounded-lg`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
    </div>
  )
}
