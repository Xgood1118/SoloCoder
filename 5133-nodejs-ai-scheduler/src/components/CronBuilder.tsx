import { useState, useEffect, useCallback } from 'react'

interface CronBuilderProps {
  value: string
  onChange: (expr: string) => void
}

const PRESETS = [
  { label: '每分钟', value: '* * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天零点', value: '0 0 * * *' },
  { label: '每周一零点', value: '0 0 * * 1' },
  { label: '每月1日零点', value: '0 0 1 * *' },
]

const FIELDS = [
  { key: 'minute', label: '分', range: [0, 59] },
  { key: 'hour', label: '时', range: [0, 23] },
  { key: 'day', label: '日', range: [1, 31] },
  { key: 'month', label: '月', range: [1, 12] },
  { key: 'weekday', label: '周', range: [0, 6] },
]

export default function CronBuilder({ value, onChange }: CronBuilderProps) {
  const [nextRuns, setNextRuns] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showPreset, setShowPreset] = useState(false)

  const parts = value.split(' ')
  while (parts.length < 5) parts.push('*')

  const fetchNextRuns = useCallback(async (expr: string) => {
    try {
      const res = await fetch('/api/cron/next-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: expr }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setNextRuns([])
      } else {
        setError(null)
        setNextRuns(data.data ?? data.nextRuns ?? [])
      }
    } catch {
      setError('无法验证表达式')
      setNextRuns([])
    }
  }, [])

  useEffect(() => {
    if (value && value.split(' ').length === 5) {
      fetchNextRuns(value)
    }
  }, [value, fetchNextRuns])

  const updateField = (index: number, val: string) => {
    const newParts = [...parts]
    newParts[index] = val
    onChange(newParts.join(' '))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 font-mono text-brand-cyan text-glow-cyan text-center text-lg tracking-widest">
          {value}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPreset(!showPreset)}
            className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text hover:border-brand-cyan transition-colors"
          >
            预设
          </button>
          {showPreset && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-brand-surface border border-brand-border rounded-lg shadow-xl py-1 min-w-[140px]">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    onChange(p.value)
                    setShowPreset(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-brand-text hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {FIELDS.map((field, i) => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-xs text-brand-muted font-mono text-center block">
              {field.label}
            </label>
            <input
              type="text"
              value={parts[i]}
              onChange={(e) => updateField(i, e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 font-mono text-sm text-brand-text text-center focus:border-brand-cyan focus:outline-none transition-colors"
            />
            <div className="text-[10px] text-brand-muted text-center">
              {field.range[0]}-{field.range[1]}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-brand-red text-xs font-mono">{error}</div>
      )}

      {nextRuns.length > 0 && (
        <div className="bg-brand-bg border border-brand-border rounded-lg p-3">
          <div className="text-xs text-brand-muted font-mono mb-2">下次执行时间</div>
          <div className="space-y-1">
            {nextRuns.map((run, i) => (
              <div key={i} className="text-xs font-mono text-brand-cyan">
                {new Date(run).toLocaleString('zh-CN')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
