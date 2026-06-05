import { create } from 'zustand'

export interface RetryPolicy {
  maxRetries: number
  retryIntervalMs: number
  retryStrategy: 'fixed' | 'exponential'
  exponentialBase: number
}

export interface TimeoutPolicy {
  warnTimeoutMs: number
  forceTimeoutMs: number
  onWarnAction: 'alert' | 'alert_and_continue' | 'silent'
  onForceAction: 'kill_and_fail' | 'kill_and_retry'
}

export interface AlertPolicy {
  channels: ('webhook' | 'email')[]
  webhookUrls: string[]
  emailRecipients: string[]
  onTimeout: boolean
  onFailure: boolean
  onRetry: boolean
}

export interface Task {
  id: string
  name: string
  type: 'once' | 'cron' | 'interval'
  cronExpression?: string
  intervalSeconds?: number
  executorType: 'script' | 'http'
  scriptPath?: string
  httpUrl?: string
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  httpHeaders?: Record<string, string>
  httpBody?: string
  parameters?: Record<string, unknown>
  enabled: boolean
  retryPolicy: RetryPolicy
  timeoutPolicy: TimeoutPolicy
  alertPolicy: AlertPolicy
  dependencies: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TaskFilter {
  status?: string
  type?: string
  search?: string
}

interface TaskState {
  tasks: Task[]
  selectedTask: Task | null
  loading: boolean
  error: string | null
  fetchTasks: (filter?: TaskFilter) => Promise<void>
  fetchTaskById: (id: string) => Promise<void>
  createTask: (data: Partial<Task>) => Promise<Task>
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  triggerTask: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  selectedTask: null,
  loading: false,
  error: null,

  fetchTasks: async (filter?: TaskFilter) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filter?.status) params.set('status', filter.status)
      if (filter?.type) params.set('type', filter.type)
      if (filter?.search) params.set('search', filter.search)
      const res = await fetch(`/api/tasks?${params.toString()}`)
      const data = await res.json()
      set({ tasks: data.data ?? data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchTaskById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/tasks/${id}`)
      const data = await res.json()
      set({ selectedTask: data.data ?? data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createTask: async (data: Partial<Task>) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      const task = result.data ?? result
      set((state) => ({ tasks: [...state.tasks, task], loading: false }))
      return task
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  updateTask: async (id: string, data: Partial<Task>) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      const task = result.data ?? result
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        selectedTask: state.selectedTask?.id === id ? task : state.selectedTask,
        loading: false,
      }))
      return task
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  deleteTask: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
        loading: false,
      }))
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  toggleTask: async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}/toggle`, { method: 'POST' })
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, enabled: !t.enabled } : t
        ),
        selectedTask:
          state.selectedTask?.id === id
            ? { ...state.selectedTask, enabled: !state.selectedTask.enabled }
            : state.selectedTask,
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  triggerTask: async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}/trigger`, { method: 'POST' })
    } catch (e: any) {
      set({ error: e.message })
    }
  },
}))
