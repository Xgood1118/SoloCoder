import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Download } from 'lucide-react'

interface LogViewerProps {
  executionId: string
  logs: string[]
}

export default function LogViewer({ executionId, logs: initialLogs }: LogViewerProps) {
  const [logs, setLogs] = useState<string[]>(initialLogs)
  const [searchTerm, setSearchTerm] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    setLogs(initialLogs)
  }, [initialLogs])

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/logs/${executionId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      setLogs((prev) => [...prev, event.data])
    }

    ws.onerror = () => {}
    ws.onclose = () => {}

    return () => {
      ws.close()
    }
  }, [executionId])

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }, [])

  const handleDownload = () => {
    const content = logs.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `execution-${executionId}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredLogs = searchTerm
    ? logs.filter((log) => log.toLowerCase().includes(searchTerm.toLowerCase()))
    : logs

  return (
    <div className="terminal-bg rounded-lg border border-brand-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-brand-border bg-brand-surface/50">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-brand-red" />
            <div className="w-3 h-3 rounded-full bg-brand-amber" />
            <div className="w-3 h-3 rounded-full bg-brand-green" />
          </div>
          <span className="text-xs text-brand-muted font-mono">
            log: {executionId.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索日志..."
              className="bg-brand-bg border border-brand-border rounded pl-7 pr-3 py-1 text-xs font-mono text-brand-text focus:border-brand-cyan focus:outline-none w-40"
            />
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 hover:bg-brand-border/30 rounded transition-colors text-brand-muted hover:text-brand-text"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {!autoScroll && (
            <button
              type="button"
              onClick={() => setAutoScroll(true)}
              className="text-xs text-brand-cyan hover:underline font-mono"
            >
              跟随
            </button>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-72 overflow-y-auto p-4 text-xs font-mono leading-relaxed scan-line"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-brand-muted">暂无日志</div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              <span className="text-brand-muted mr-3 select-none">
                {String(i + 1).padStart(4, ' ')}
              </span>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
