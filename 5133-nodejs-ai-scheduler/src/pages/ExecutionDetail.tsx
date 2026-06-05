import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useExecutionStore } from '@/store/executionStore'
import StatusBadge from '@/components/StatusBadge'
import LogViewer from '@/components/LogViewer'

export default function ExecutionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedExecution, fetchExecutionById } = useExecutionStore()
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    if (id) {
      fetchExecutionById(id)
    }
  }, [id, fetchExecutionById])

  useEffect(() => {
    if (selectedExecution?.output) {
      setLogs(selectedExecution.output.split('\n'))
    }
  }, [selectedExecution?.output])

  if (!selectedExecution) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-muted">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/records')}
          className="p-1.5 text-brand-muted hover:text-brand-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-mono font-bold text-brand-text">执行详情</h1>
        <StatusBadge status={selectedExecution.status} />
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <span className="text-xs text-brand-muted font-mono">任务名称</span>
            <div className="text-sm text-brand-text mt-0.5">{selectedExecution.taskName}</div>
          </div>
          <div>
            <span className="text-xs text-brand-muted font-mono">触发时间</span>
            <div className="text-sm text-brand-text mt-0.5">
              {new Date(selectedExecution.triggerTime).toLocaleString('zh-CN')}
            </div>
          </div>
          <div>
            <span className="text-xs text-brand-muted font-mono">耗时</span>
            <div className="text-sm text-brand-text mt-0.5">
              {selectedExecution.durationMs != null
                ? `${(selectedExecution.durationMs / 1000).toFixed(1)}s`
                : '-'}
            </div>
          </div>
          <div>
            <span className="text-xs text-brand-muted font-mono">重试次数</span>
            <div className="text-sm text-brand-text mt-0.5">{selectedExecution.retryCount}</div>
          </div>
          {selectedExecution.startTime && (
            <div>
              <span className="text-xs text-brand-muted font-mono">开始时间</span>
              <div className="text-sm text-brand-text mt-0.5">
                {new Date(selectedExecution.startTime).toLocaleString('zh-CN')}
              </div>
            </div>
          )}
          {selectedExecution.endTime && (
            <div>
              <span className="text-xs text-brand-muted font-mono">结束时间</span>
              <div className="text-sm text-brand-text mt-0.5">
                {new Date(selectedExecution.endTime).toLocaleString('zh-CN')}
              </div>
            </div>
          )}
          {selectedExecution.exitCode != null && (
            <div>
              <span className="text-xs text-brand-muted font-mono">退出码</span>
              <div className={`text-sm font-mono mt-0.5 ${selectedExecution.exitCode === 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                {selectedExecution.exitCode}
              </div>
            </div>
          )}
          {selectedExecution.isRetry && (
            <div>
              <span className="text-xs text-brand-muted font-mono">重试执行</span>
              <div className="text-sm text-brand-amber mt-0.5">是</div>
            </div>
          )}
        </div>
        {selectedExecution.error && (
          <div className="mt-4 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg">
            <span className="text-xs text-brand-muted font-mono">错误信息</span>
            <div className="text-sm text-brand-red font-mono mt-1 whitespace-pre-wrap">
              {selectedExecution.error}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-mono font-bold text-brand-text mb-3">执行日志</h2>
        <LogViewer executionId={selectedExecution.id} logs={logs} />
      </div>
    </div>
  )
}
