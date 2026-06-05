import { useEffect, useState } from 'react'
import { Send, Plus, Edit2, Trash2, Zap } from 'lucide-react'
import { useConfigStore } from '@/store/configStore'
import { useAlertStore } from '@/store/alertStore'
import type { NotificationChannel } from '@/store/alertStore'

export default function Settings() {
  const { config, fetchConfig, updateConfig } = useConfigStore()
  const { channels, fetchChannels, createChannel, updateChannel, deleteChannel, testChannel } = useAlertStore()
  const [showChannelForm, setShowChannelForm] = useState(false)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [channelForm, setChannelForm] = useState<Partial<NotificationChannel>>({
    type: 'webhook',
    name: '',
    webhookUrl: '',
    enabled: true,
  })

  useEffect(() => {
    fetchConfig()
    fetchChannels()
  }, [fetchConfig, fetchChannels])

  const handleSaveConfig = async () => {
    if (!config) return
    await updateConfig(config)
  }

  const handleChannelSubmit = async () => {
    if (editingChannel) {
      await updateChannel(editingChannel.id, channelForm)
    } else {
      await createChannel(channelForm)
    }
    setShowChannelForm(false)
    setEditingChannel(null)
    setChannelForm({ type: 'webhook', name: '', webhookUrl: '', enabled: true })
  }

  const handleEditChannel = (channel: NotificationChannel) => {
    setEditingChannel(channel)
    setChannelForm(channel)
    setShowChannelForm(true)
  }

  const handleDeleteChannel = async (id: string) => {
    if (window.confirm('确定删除此通知渠道？')) {
      await deleteChannel(id)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-mono font-bold text-brand-text">系统设置</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className="text-sm font-mono font-bold text-brand-text mb-4">默认超时策略</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">警告超时(ms)</label>
              <input
                type="number"
                value={config?.defaultTimeoutPolicy?.warnTimeoutMs ?? 300000}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    defaultTimeoutPolicy: {
                      ...config.defaultTimeoutPolicy,
                      warnTimeoutMs: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">强制超时(ms)</label>
              <input
                type="number"
                value={config?.defaultTimeoutPolicy?.forceTimeoutMs ?? 1800000}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    defaultTimeoutPolicy: {
                      ...config.defaultTimeoutPolicy,
                      forceTimeoutMs: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">警告动作</label>
              <select
                value={config?.defaultTimeoutPolicy?.onWarnAction ?? 'alert'}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    defaultTimeoutPolicy: {
                      ...config.defaultTimeoutPolicy,
                      onWarnAction: e.target.value as 'alert' | 'alert_and_continue' | 'silent',
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
                value={config?.defaultTimeoutPolicy?.onForceAction ?? 'kill_and_fail'}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    defaultTimeoutPolicy: {
                      ...config.defaultTimeoutPolicy,
                      onForceAction: e.target.value as 'kill_and_fail' | 'kill_and_retry',
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

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className="text-sm font-mono font-bold text-brand-text mb-4">默认重试策略</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">最大重试次数</label>
              <input
                type="number"
                value={config?.defaultRetryPolicy?.maxRetries ?? 3}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    defaultRetryPolicy: {
                      ...config.defaultRetryPolicy,
                      maxRetries: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">重试间隔(ms)</label>
              <input
                type="number"
                value={config?.defaultRetryPolicy?.retryIntervalMs ?? 60000}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    defaultRetryPolicy: {
                      ...config.defaultRetryPolicy,
                      retryIntervalMs: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">重试策略</label>
              <select
                value={config?.defaultRetryPolicy?.retryStrategy ?? 'fixed'}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    defaultRetryPolicy: {
                      ...config.defaultRetryPolicy,
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
            <div>
              <label className="block text-xs text-brand-muted font-mono mb-1.5">最大并发任务</label>
              <input
                type="number"
                value={config?.maxConcurrentTasks ?? 10}
                onChange={(e) =>
                  config && updateConfig({
                    ...config,
                    maxConcurrentTasks: Number(e.target.value),
                  })
                }
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono font-bold text-brand-text">通知渠道</h2>
          <button
            type="button"
            onClick={() => {
              setEditingChannel(null)
              setChannelForm({ type: 'webhook', name: '', webhookUrl: '', enabled: true })
              setShowChannelForm(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-brand-cyan border border-brand-cyan/30 rounded-lg hover:bg-brand-cyan/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加渠道
          </button>
        </div>

        {showChannelForm && (
          <div className="bg-brand-bg border border-brand-border rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">渠道类型</label>
                <select
                  value={channelForm.type}
                  onChange={(e) => setChannelForm((f) => ({ ...f, type: e.target.value as 'webhook' | 'email' }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                >
                  <option value="webhook">Webhook</option>
                  <option value="email">邮件</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-brand-muted font-mono mb-1.5">名称</label>
                <input
                  type="text"
                  value={channelForm.name ?? ''}
                  onChange={(e) => setChannelForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                />
              </div>
              {channelForm.type === 'webhook' && (
                <div className="col-span-2">
                  <label className="block text-xs text-brand-muted font-mono mb-1.5">Webhook URL</label>
                  <input
                    type="text"
                    value={channelForm.webhookUrl ?? ''}
                    onChange={(e) => setChannelForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                    className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text font-mono focus:border-brand-cyan focus:outline-none"
                  />
                </div>
              )}
              {channelForm.type === 'email' && (
                <>
                  <div>
                    <label className="block text-xs text-brand-muted font-mono mb-1.5">SMTP 主机</label>
                    <input
                      type="text"
                      value={channelForm.emailSmtpHost ?? ''}
                      onChange={(e) => setChannelForm((f) => ({ ...f, emailSmtpHost: e.target.value }))}
                      className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-muted font-mono mb-1.5">SMTP 端口</label>
                    <input
                      type="number"
                      value={channelForm.emailSmtpPort ?? 587}
                      onChange={(e) => setChannelForm((f) => ({ ...f, emailSmtpPort: Number(e.target.value) }))}
                      className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-muted font-mono mb-1.5">用户名</label>
                    <input
                      type="text"
                      value={channelForm.emailUser ?? ''}
                      onChange={(e) => setChannelForm((f) => ({ ...f, emailUser: e.target.value }))}
                      className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-muted font-mono mb-1.5">发件地址</label>
                    <input
                      type="text"
                      value={channelForm.emailFrom ?? ''}
                      onChange={(e) => setChannelForm((f) => ({ ...f, emailFrom: e.target.value }))}
                      className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleChannelSubmit}
                className="px-4 py-2 bg-brand-cyan text-brand-bg rounded-lg text-sm font-mono font-bold hover:bg-brand-cyan/90 transition-colors"
              >
                {editingChannel ? '更新' : '创建'}
              </button>
              <button
                type="button"
                onClick={() => { setShowChannelForm(false); setEditingChannel(null) }}
                className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {channels.length === 0 ? (
            <div className="text-center py-8 text-brand-muted text-sm">暂无通知渠道</div>
          ) : (
            channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between px-4 py-3 bg-brand-bg/50 rounded-lg border border-brand-border/50"
              >
                <div className="flex items-center gap-3">
                  <Send className={`w-4 h-4 ${channel.enabled ? 'text-brand-cyan' : 'text-brand-muted'}`} />
                  <div>
                    <div className="text-sm font-mono text-brand-text">{channel.name}</div>
                    <div className="text-xs text-brand-muted">
                      {channel.type === 'webhook' ? channel.webhookUrl : `${channel.emailSmtpHost}:${channel.emailSmtpPort}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => testChannel(channel.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-brand-cyan hover:bg-brand-cyan/10 rounded transition-colors"
                    title="测试"
                  >
                    <Zap className="w-3 h-3" />
                    测试
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditChannel(channel)}
                    className="p-1.5 text-brand-muted hover:text-brand-cyan transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChannel(channel.id)}
                    className="p-1.5 text-brand-muted hover:text-brand-red transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
