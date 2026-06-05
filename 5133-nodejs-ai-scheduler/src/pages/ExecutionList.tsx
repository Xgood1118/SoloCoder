import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useExecutionStore } from '@/store/executionStore'
import StatusBadge from '@/components/StatusBadge'
import type { ExecutionFilter } from '@/store/executionStore'

export default function ExecutionList() {
  const navigate = useNavigate()
  const { executions, fetchExecutions, exportExecutions } = useExecutionStore()
  const [filter, setFilter] = useState<ExecutionFilter>({})
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    fetchExecutions(filter)
  }, [filter, fetchExecutions])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-mono font-bold text-brand-text">执行记录</h1>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExport(!showExport)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text hover:border-brand-cyan transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-brand-surface border border-brand-border rounded-lg shadow-xl py-1 min-w-[120px]">
              <button
                type="button"
                onClick={() => { exportExecutions('csv'); setShowExport(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brand-text hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => { exportExecutions('json'); setShowExport(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brand-text hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors"
              >
                <FileJson className="w-4 h-4" />
                JSON
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={filter.status ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
          className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="running">运行中</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
          <option value="timeout">超时</option>
          <option value="skipped">已跳过</option>
        </select>
        <input
          type="date"
          value={filter.from ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value || undefined }))}
          className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
        />
        <span className="text-brand-muted text-sm">至</span>
        <input
          type="date"
          value={filter.to ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value || undefined }))}
          className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
        />
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">任务名称</th>
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">触发时间</th>
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">耗时</th>
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">状态</th>
              <th className="text-right px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {executions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-brand-muted text-sm">
                  暂无执行记录
                </td>
              </tr>
            ) : (
              executions.map((exec) => (
                <tr
                  key={exec.id}
                  className="border-b border-brand-border/50 hover:bg-brand-cyan/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/records/${exec.id}`)}
                >
                  <td className="px-5 py-3.5 text-sm font-mono text-brand-text">{exec.taskName}</td>
                  <td className="px-5 py-3.5 text-xs text-brand-muted">
                    {new Date(exec.triggerTime).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-brand-text">
                    {exec.durationMs != null ? `${(exec.durationMs / 1000).toFixed(1)}s` : '-'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={exec.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/records/${exec.id}`) }}
                      className="text-xs text-brand-cyan hover:underline font-mono"
                    >
                      查看日志
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
