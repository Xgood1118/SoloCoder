import { create } from 'zustand'
import type { ExecutionRecord } from './executionStore'

export interface DashboardStats {
  totalTasks: number
  runningTasks: number
  successRate: number
  recentExecutions: ExecutionRecord[]
  pendingAlerts: number
}

interface DashboardState {
  stats: DashboardStats | null
  loading: boolean
  fetchStats: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  loading: false,

  fetchStats: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/dashboard/stats')
      const data = await res.json()
      set({ stats: data.data ?? data, loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))
