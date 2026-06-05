import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CronBuilder from './CronBuilder'
import DAGEditor from './DAGEditor'
import { useTaskStore } from '@/store/taskStore'
import type { Task, RetryPolicy, TimeoutPolicy, AlertPolicy } from '@/store/taskStore'

interface TaskFormProps {
  initialData?: Task
  onSubmit: (data: Partial<Task>) => void
  onCancel: () => void
}

const STEPS = ['基本信息', '调度配置', '执行配置', '重试与超时', '依赖与告警']

const defaultRetryPolicy: RetryPolicy = {
  maxRetries: 3,
  retryIntervalMs: 60000,
  retryStrategy: 'fixed',
  exponentialBase: 2,
}

const defaultTimeoutPolicy: TimeoutPolicy = {
  warnTimeoutMs: 300000,
  forceTimeoutMs: 1800000,
  onWarnAction: 'alert',
  onForceAction: 'kill_and_fail',
}

const defaultAlertPolicy: AlertPolicy = {
  channels: ['webhook'],
  webhookUrls: [],
  emailRecipients: [],
  onTimeout: true,
  onFailure: true,
  onRetry: false,
}

export default function TaskForm({ initialData, onSubmit, onCancel }: TaskFormProps) {
  const [step, setStep] = useState(0)
  const { tasks } = useTaskStore()

  const [form, setForm] = useState<Partial<Task>>({
    name: '',
    type: 'cron',
    executorType: 'script',
    enabled: true,
    cronExpression: '* * * * *',
    intervalSeconds: 60,
    scriptPath: '',
    httpUrl: '',
    httpMethod: 'GET',
    httpHeaders: {},
    httpBody: '',
    retryPolicy: defaultRetryPolicy,
    timeoutPolicy: defaultTimeoutPolicy,
    alertPolicy: defaultAlertPolicy,
    dependencies: [],
    ...initialData,
  })

  useEffect(() => {
    if (!tasks.length) {
      useTaskStore.getState().fetchTasks()
    }
  }, [tasks.length])

  const updateForm = (updates: Partial<Task>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const handleSubmit = () => {
    onSubmit(form)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                i === step
                  ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30'
                  : i < step
                  ? 'text-brand-green'
                  : 'text-brand-muted'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                i === step
                  ? 'bg-brand-cyan/20 text-brand-cyan'
                  : i < step
                  ? 'bg-brand-green/20 text-brand-green'
                  : 'bg-brand-border text-brand-muted'
              }`}>
                {i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-6 h-px bg-brand-border mx-1" />
            )}
          </div>
        ))}
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">任务名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none transition-colors"
                placeholder="输入任务名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">任务类型</label>
                <select
                  value={form.type}
                  onChange={(e) => updateForm({ type: e.target.value as Task['type'] })}
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                >
                  <option value="once">一次性</option>
                  <option value="cron">Cron 表达式</option>
                  <option value="interval">固定间隔</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">执行器类型</label>
                <select
                  value={form.executorType}
                  onChange={(e) => updateForm({ executorType: e.target.value as Task['executorType'] })}
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                >
                  <option value="script">脚本</option>
                  <option value="http">HTTP 请求</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {form.type === 'cron' && (
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">Cron 表达式</label>
                <CronBuilder
                  value={form.cronExpression ?? '* * * * *'}
                  onChange={(expr) => updateForm({ cronExpression: expr })}
                />
              </div>
            )}
            {form.type === 'interval' && (
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">间隔秒数</label>
                <input
                  type="number"
                  value={form.intervalSeconds ?? 60}
                  onChange={(e) => updateForm({ intervalSeconds: Number(e.target.value) })}
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                  min={1}
                />
              </div>
            )}
            {form.type === 'once' && (
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">执行时间</label>
                <input
                  type="datetime-local"
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {form.executorType === 'script' ? (
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">脚本路径</label>
                <input
                  type="text"
                  value={form.scriptPath ?? ''}
                  onChange={(e) => updateForm({ scriptPath: e.target.value })}
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text font-mono focus:border-brand-cyan focus:outline-none"
                  placeholder="/path/to/script.sh"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-brand-muted font-mono mb-1.5">方法</label>
                    <select
                      value={form.httpMethod ?? 'GET'}
                      onChange={(e) => updateForm({ httpMethod: e.target.value as Task['httpMethod'] })}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs text-brand-muted font-mono mb-1.5">URL</label>
                    <input
                      type="text"
                      value={form.httpUrl ?? ''}
                      onChange={(e) => updateForm({ httpUrl: e.target.value })}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text font-mono focus:border-brand-cyan focus:outline-none"
                      placeholder="https://api.example.com/endpoint"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">Headers (JSON)</label>
                  <textarea
                    value={JSON.stringify(form.httpHeaders ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        updateForm({ httpHeaders: JSON.parse(e.target.value) })
                      } catch {}
                    }}
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text font-mono focus:border-brand-cyan focus:outline-none h-24 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">Body</label>
                  <textarea
                    value={form.httpBody ?? ''}
                    onChange={(e) => updateForm({ httpBody: e.target.value })}
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text font-mono focus:border-brand-cyan focus:outline-none h-24 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-mono text-brand-text mb-3">重试策略</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">最大重试次数</label>
                  <input
                    type="number"
                    value={form.retryPolicy?.maxRetries ?? 3}
                    onChange={(e) =>
                      updateForm({
                        retryPolicy: { ...form.retryPolicy!, maxRetries: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">重试间隔(ms)</label>
                  <input
                    type="number"
                    value={form.retryPolicy?.retryIntervalMs ?? 60000}
                    onChange={(e) =>
                      updateForm({
                        retryPolicy: { ...form.retryPolicy!, retryIntervalMs: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                    min={1000}
                  />
                </div>
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">重试策略</label>
                  <select
                    value={form.retryPolicy?.retryStrategy ?? 'fixed'}
                    onChange={(e) =>
                      updateForm({
                        retryPolicy: {
                          ...form.retryPolicy!,
                          retryStrategy: e.target.value as 'fixed' | 'exponential',
                        },
                      })
                    }
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                  >
                    <option value="fixed">固定间隔</option>
                    <option value="exponential">指数退避</option>
                  </select>
                </div>
                {form.retryPolicy?.retryStrategy === 'exponential' && (
                  <div>
                    <label className="block text-xs text-brand-muted font-mono mb-1.5">指数基数</label>
                    <input
                      type="number"
                      value={form.retryPolicy?.exponentialBase ?? 2}
                      onChange={(e) =>
                        updateForm({
                          retryPolicy: { ...form.retryPolicy!, exponentialBase: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                      min={2}
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-mono text-brand-text mb-3">超时策略</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">警告超时(ms)</label>
                  <input
                    type="number"
                    value={form.timeoutPolicy?.warnTimeoutMs ?? 300000}
                    onChange={(e) =>
                      updateForm({
                        timeoutPolicy: { ...form.timeoutPolicy!, warnTimeoutMs: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">强制超时(ms)</label>
                  <input
                    type="number"
                    value={form.timeoutPolicy?.forceTimeoutMs ?? 1800000}
                    onChange={(e) =>
                      updateForm({
                        timeoutPolicy: { ...form.timeoutPolicy!, forceTimeoutMs: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">警告动作</label>
                  <select
                    value={form.timeoutPolicy?.onWarnAction ?? 'alert'}
                    onChange={(e) =>
                      updateForm({
                        timeoutPolicy: {
                          ...form.timeoutPolicy!,
                          onWarnAction: e.target.value as TimeoutPolicy['onWarnAction'],
                        },
                      })
                    }
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                  >
                    <option value="alert">发送告警</option>
                    <option value="alert_and_continue">告警并继续</option>
                    <option value="silent">静默</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">强制动作</label>
                  <select
                    value={form.timeoutPolicy?.onForceAction ?? 'kill_and_fail'}
                    onChange={(e) =>
                      updateForm({
                        timeoutPolicy: {
                          ...form.timeoutPolicy!,
                          onForceAction: e.target.value as TimeoutPolicy['onForceAction'],
                        },
                      })
                    }
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                  >
                    <option value="kill_and_fail">终止并标记失败</option>
                    <option value="kill_and_retry">终止并重试</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-mono text-brand-text mb-3">任务依赖</h3>
              <DAGEditor
                tasks={tasks}
                dependencies={form.dependencies ?? []}
                onChange={(deps) => updateForm({ dependencies: deps })}
              />
            </div>

            <div>
              <h3 className="text-sm font-mono text-brand-text mb-3">告警策略</h3>
              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.alertPolicy?.onTimeout ?? true}
                    onChange={(e) =>
                      updateForm({
                        alertPolicy: { ...form.alertPolicy!, onTimeout: e.target.checked },
                      })
                    }
                    className="accent-brand-cyan"
                  />
                  超时告警
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.alertPolicy?.onFailure ?? true}
                    onChange={(e) =>
                      updateForm({
                        alertPolicy: { ...form.alertPolicy!, onFailure: e.target.checked },
                      })
                    }
                    className="accent-brand-cyan"
                  />
                  失败告警
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.alertPolicy?.onRetry ?? false}
                    onChange={(e) =>
                      updateForm({
                        alertPolicy: { ...form.alertPolicy!, onRetry: e.target.checked },
                      })
                    }
                    className="accent-brand-cyan"
                  />
                  重试告警
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="flex items-center gap-1 px-4 py-2 text-sm text-brand-muted hover:text-brand-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          上一步
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            取消
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-5 py-2 bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 rounded-lg text-sm font-mono hover:bg-brand-cyan/20 transition-colors"
            >
              下一步
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 bg-brand-cyan text-brand-bg rounded-lg text-sm font-mono font-bold hover:bg-brand-cyan/90 transition-colors"
            >
              保存
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
