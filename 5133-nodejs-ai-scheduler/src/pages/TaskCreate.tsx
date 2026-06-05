import { useNavigate } from 'react-router-dom'
import { useTaskStore } from '@/store/taskStore'
import TaskForm from '@/components/TaskForm'
import type { Task } from '@/store/taskStore'

export default function TaskCreate() {
  const navigate = useNavigate()
  const { createTask } = useTaskStore()

  const handleSubmit = async (data: Partial<Task>) => {
    await createTask(data)
    navigate('/tasks')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-mono font-bold text-brand-text">创建任务</h1>
      <TaskForm onSubmit={handleSubmit} onCancel={() => navigate('/tasks')} />
    </div>
  )
}
