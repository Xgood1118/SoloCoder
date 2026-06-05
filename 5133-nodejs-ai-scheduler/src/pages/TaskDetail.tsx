import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Edit2, ToggleLeft, ToggleRight, Play, Trash2, ArrowLeft } from 'lucide-react'
import { useTaskStore } from '@/store/taskStore'
import { useExecutionStore } from '@/store/executionStore'
import StatusBadge from '@/components/StatusBadge'
import DAGEditor from '@/components/DAGEditor'
import LogViewer from '@/components/LogViewer'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedTask, fetchTaskById, toggleTask, triggerTask, deleteTask, tasks } = useTaskStore()
  const { executions, fetchExecutions } = useExecutionStore()
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    if (id) {
      fetchTaskById(id)
      fetchExecutions({ taskId: id })
    }
  }, [id, fetchTaskById, fetchExecutions])

  useEffect(() => {
    if (executions.length > 0 && executions[0].output) {
      setLogs(executions[0].output.split('\n'))
    }
  }, [executions])

  const handleDelete = async () => {
    if (!id) return
    if (window.confirm('确定删除此任务？')) {
      await deleteTask(id)
      navigate('/tasks')
    }
  }

  if (!selectedTask) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-muted">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="p-1.5 text-brand-muted hover:text-brand-text transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-mono font-bold text-brand-text">{selectedTask.name}</h1>
          <StatusBadge status={selectedTask.enabled ? 'success' : 'skipped'} label={selectedTask.enabled ? '已启用' : '已禁用'} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/tasks/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-muted hover:text-brand-cyan border border-brand-border rounded-lg transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            编辑
          </button>
          <button
            type="button"
            onClick={() => id && toggleTask(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-muted hover:text-brand-amber border border-brand-border rounded-lg transition-colors"
          >
            {selectedTask.enabled ? (
              <><ToggleRight className="w-3.5 h-3.5" /> 禁用</>
            ) : (
              <><ToggleLeft className="w-3.5 h-3.5" /> 启用</>
            )}
          </button>
          <button
            type="button"
            onClick={() => id && triggerTask(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-muted hover:text-brand-green border border-brand-border rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            触发
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-muted hover:text-brand-red border border-brand-border rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
            <h2 className="text-sm font-mono font-bold text-brand-text mb-4">任务配置</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-brand-muted font-mono">类型</span>
                <div className="text-sm text-brand-text mt-0.5">{selectedTask.type}</div>
              </div>
              <div>
                <span className="text-xs text-brand-muted font-mono">执行器</span>
                <div className="text-sm text-brand-text mt-0.5">{selectedTask.executorType}</div>
              </div>
              {selectedTask.type === 'cron' && (
                <div>
                  <span className="text-xs text-brand-muted font-mono">Cron 表达式</span>
                  <div className="text-sm text-brand-cyan font-mono mt-0.5">{selectedTask.cronExpression}</div>
                </div>
              )}
              {selectedTask.type === 'interval' && (
                <div>
                  <span className="text-xs text-brand-muted font-mono">间隔</span>
                  <div className="text-sm text-brand-text mt-0.5">{selectedTask.intervalSeconds}s</div>
                </div>
              )}
              {selectedTask.executorType === 'script' && (
                <div>
                  <span className="text-xs text-brand-muted font-mono">脚本路径</span>
                  <div className="text-sm text-brand-text font-mono mt-0.5">{selectedTask.scriptPath}</div>
                </div>
              )}
              {selectedTask.executorType === 'http' && (
                <>
                  <div>
                    <span className="text-xs text-brand-muted font-mono">HTTP 方法</span>
                    <div className="text-sm text-brand-text mt-0.5">{selectedTask.httpMethod}</div>
                  </div>
                  <div>
                    <span className="text-xs text-brand-muted font-mono">URL</span>
                    <div className="text-sm text-brand-text font-mono mt-0.5 break-all">{selectedTask.httpUrl}</div>
                  </div>
                </>
              )}
              <div>
                <span className="text-xs text-brand-muted font-mono">最大重试</span>
                <div className="text-sm text-brand-text mt-0.5">{selectedTask.retryPolicy?.maxRetries}</div>
              </div>
              <div>
                <span className="text-xs text-brand-muted font-mono">重试策略</span>
                <div className="text-sm text-brand-text mt-0.5">{selectedTask.retryPolicy?.retryStrategy}</div>
              </div>
              <div>
                <span className="text-xs text-brand-muted font-mono">警告超时</span>
                <div className="text-sm text-brand-text mt-0.5">{(selectedTask.timeoutPolicy?.warnTimeoutMs ?? 0) / 1000}s</div>
              </div>
              <div>
                <span className="text-xs text-brand-muted font-mono">强制超时</span>
                <div className="text-sm text-brand-text mt-0.5">{(selectedTask.timeoutPolicy?.forceTimeoutMs ?? 0) / 1000}s</div>
              </div>
            </div>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
            <h2 className="text-sm font-mono font-bold text-brand-text mb-4">近期执行</h2>
            <div className="space-y-2">
              {executions.length === 0 ? (
                <div className="text-brand-muted text-sm text-center py-6">暂无执行记录</div>
              ) : (
                executions.slice(0, 10).map((exec) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between px-4 py-2.5 bg-brand-bg/50 rounded-lg hover:bg-brand-cyan/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/records/${exec.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={exec.status} />
                      <span className="text-sm font-mono text-brand-text">{exec.taskName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-brand-muted">
                      <span>{new Date(exec.triggerTime).toLocaleString('zh-CN')}</span>
                      {exec.durationMs != null && <span>{(exec.durationMs / 1000).toFixed(1)}s</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
            <h2 className="text-sm font-mono font-bold text-brand-text mb-4">依赖关系</h2>
            {(selectedTask.dependencies?.length ?? 0) === 0 ? (
              <div className="text-brand-muted text-sm text-center py-4">无依赖</div>
            ) : (
              <DAGEditor
                tasks={tasks}
                dependencies={selectedTask.dependencies ?? []}
                onChange={() => {}}
              />
            )}
          </div>

          {executions.length > 0 && (
            <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
              <h2 className="text-sm font-mono font-bold text-brand-text mb-4">实时日志</h2>
              <LogViewer executionId={executions[0].id} logs={logs} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
