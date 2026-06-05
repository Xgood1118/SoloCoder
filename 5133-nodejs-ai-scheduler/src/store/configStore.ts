import { create } from 'zustand'
import type { RetryPolicy, TimeoutPolicy } from './taskStore'

export interface SystemConfig {
  defaultTimeoutPolicy: TimeoutPolicy
  defaultRetryPolicy: RetryPolicy
  maxConcurrentTasks: number
}

interface ConfigState {
  config: SystemConfig | null
  loading: boolean
  fetchConfig: () => Promise<void>
  updateConfig: (data: Partial<SystemConfig>) => Promise<void>
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loading: false,

  fetchConfig: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      set({ config: data.data ?? data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  updateConfig: async (data: Partial<SystemConfig>) => {
    set({ loading: true })
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      set({ config: result.data ?? result, loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))
