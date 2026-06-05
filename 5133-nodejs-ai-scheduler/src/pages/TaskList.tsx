import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Play, ToggleLeft, ToggleRight, Edit2, Trash2 } from 'lucide-react'
import { useTaskStore } from '@/store/taskStore'
import StatusBadge from '@/components/StatusBadge'
import type { TaskFilter } from '@/store/taskStore'

export default function TaskList() {
  const navigate = useNavigate()
  const { tasks, fetchTasks, toggleTask, triggerTask, deleteTask } = useTaskStore()
  const [filter, setFilter] = useState<TaskFilter>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchTasks(filter)
  }, [filter, fetchTasks])

  const handleSearch = () => {
    fetchTasks({ ...filter, search })
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('确定删除此任务？')) {
      await deleteTask(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-mono font-bold text-brand-text">任务管理</h1>
        <button
          type="button"
          onClick={() => navigate('/tasks/create')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 rounded-lg text-sm font-mono hover:bg-brand-cyan/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          创建任务
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索任务名称..."
            className="w-full bg-brand-surface border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none transition-colors"
          />
        </div>
        <select
          value={filter.type ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value || undefined }))}
          className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
        >
          <option value="">全部类型</option>
          <option value="once">一次性</option>
          <option value="cron">Cron</option>
          <option value="interval">间隔</option>
        </select>
        <select
          value={filter.status ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
          className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:border-brand-cyan focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">名称</th>
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">类型</th>
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">调度规则</th>
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">状态</th>
              <th className="text-left px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">更新时间</th>
              <th className="text-right px-5 py-3 text-xs font-mono text-brand-muted uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-brand-muted text-sm">
                  暂无任务
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-brand-border/50 hover:bg-brand-cyan/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-mono text-brand-text">{task.name}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-mono text-brand-muted px-2 py-1 bg-brand-bg rounded">
                      {task.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-mono text-brand-cyan">
                      {task.type === 'cron'
                        ? task.cronExpression
                        : task.type === 'interval'
                        ? `${task.intervalSeconds}s`
                        : '一次性'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {task.enabled ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-brand-green">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                        启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-brand-muted">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-muted" />
                        禁用
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-brand-muted">
                    {new Date(task.updatedAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks/${task.id}/edit`)}
                        className="p-1.5 text-brand-muted hover:text-brand-cyan transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className="p-1.5 text-brand-muted hover:text-brand-amber transition-colors"
                        title="切换状态"
                      >
                        {task.enabled ? (
                          <ToggleRight className="w-4 h-4 text-brand-green" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerTask(task.id)}
                        className="p-1.5 text-brand-muted hover:text-brand-green transition-colors"
                        title="手动触发"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 text-brand-muted hover:text-brand-red transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
