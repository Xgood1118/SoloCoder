import { create } from 'zustand'

export interface ExecutionRecord {
  id: string
  taskId: string
  taskName: string
  triggerTime: string
  startTime: string | null
  endTime: string | null
  status: 'running' | 'success' | 'failed' | 'timeout' | 'skipped'
  exitCode: number | null
  output: string
  error: string
  retryCount: number
  isRetry: boolean
  durationMs: number | null
}

export interface ExecutionFilter {
  taskId?: string
  status?: string
  from?: string
  to?: string
}

interface ExecutionState {
  executions: ExecutionRecord[]
  selectedExecution: ExecutionRecord | null
  loading: boolean
  fetchExecutions: (filter?: ExecutionFilter) => Promise<void>
  fetchExecutionById: (id: string) => Promise<void>
  exportExecutions: (format: 'csv' | 'json') => Promise<void>
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executions: [],
  selectedExecution: null,
  loading: false,

  fetchExecutions: async (filter?: ExecutionFilter) => {
    set({ loading: true })
    try {
      const params = new URLSearchParams()
      if (filter?.taskId) params.set('taskId', filter.taskId)
      if (filter?.status) params.set('status', filter.status)
      if (filter?.from) params.set('from', filter.from)
      if (filter?.to) params.set('to', filter.to)
      const res = await fetch(`/api/executions?${params.toString()}`)
      const data = await res.json()
      set({ executions: data.data ?? data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchExecutionById: async (id: string) => {
    set({ loading: true })
    try {
      const res = await fetch(`/api/executions/${id}`)
      const data = await res.json()
      set({ selectedExecution: data.data ?? data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  exportExecutions: async (format: 'csv' | 'json') => {
    try {
      const res = await fetch(`/api/executions/export?format=${format}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `executions.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  },
}))
