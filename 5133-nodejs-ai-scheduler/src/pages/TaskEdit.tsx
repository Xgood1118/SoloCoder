import { useParams, useNavigate } from 'react-router-dom'
import { useTaskStore } from '@/store/taskStore'
import TaskForm from '@/components/TaskForm'
import type { Task } from '@/store/taskStore'

export default function TaskEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedTask, updateTask } = useTaskStore()

  const handleSubmit = async (data: Partial<Task>) => {
    if (!id) return
    await updateTask(id, data)
    navigate(`/tasks/${id}`)
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
      <h1 className="text-xl font-mono font-bold text-brand-text">编辑任务</h1>
      <TaskForm
        initialData={selectedTask}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/tasks/${id}`)}
      />
    </div>
  )
}
