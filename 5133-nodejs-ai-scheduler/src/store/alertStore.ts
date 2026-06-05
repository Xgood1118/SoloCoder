import { create } from 'zustand'

export interface AlertRecord {
  id: string
  taskId: string
  taskName: string
  executionId: string
  type: 'timeout_warn' | 'timeout_force' | 'failure' | 'retry' | 'dependency_failed'
  message: string
  channels: string[]
  status: 'pending' | 'sent' | 'acknowledged'
  createdAt: string
}

export interface NotificationChannel {
  id: string
  type: 'webhook' | 'email'
  name: string
  webhookUrl?: string
  emailSmtpHost?: string
  emailSmtpPort?: number
  emailUser?: string
  emailPass?: string
  emailFrom?: string
  enabled: boolean
}

export interface AlertFilter {
  status?: string
  type?: string
}

interface AlertState {
  alerts: AlertRecord[]
  channels: NotificationChannel[]
  pendingCount: number
  loading: boolean
  fetchAlerts: (filter?: AlertFilter) => Promise<void>
  acknowledgeAlert: (id: string) => Promise<void>
  fetchChannels: () => Promise<void>
  createChannel: (data: Partial<NotificationChannel>) => Promise<void>
  updateChannel: (id: string, data: Partial<NotificationChannel>) => Promise<void>
  deleteChannel: (id: string) => Promise<void>
  testChannel: (id: string) => Promise<void>
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  channels: [],
  pendingCount: 0,
  loading: false,

  fetchAlerts: async (filter?: AlertFilter) => {
    set({ loading: true })
    try {
      const params = new URLSearchParams()
      if (filter?.status) params.set('status', filter.status)
      if (filter?.type) params.set('type', filter.type)
      const res = await fetch(`/api/alerts?${params.toString()}`)
      const data = await res.json()
      const alerts = data.data ?? data
      set({
        alerts,
        pendingCount: alerts.filter((a: AlertRecord) => a.status === 'pending').length,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  acknowledgeAlert: async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' })
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, status: 'acknowledged' as const } : a
        ),
        pendingCount: Math.max(0, state.pendingCount - 1),
      }))
    } catch {}
  },

  fetchChannels: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/channels')
      const data = await res.json()
      set({ channels: data.data ?? data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createChannel: async (data: Partial<NotificationChannel>) => {
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      const channel = result.data ?? result
      set((state) => ({ channels: [...state.channels, channel] }))
    } catch {}
  },

  updateChannel: async (id: string, data: Partial<NotificationChannel>) => {
    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      const channel = result.data ?? result
      set((state) => ({
        channels: state.channels.map((c) => (c.id === id ? channel : c)),
      }))
    } catch {}
  },

  deleteChannel: async (id: string) => {
    try {
      await fetch(`/api/channels/${id}`, { method: 'DELETE' })
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== id),
      }))
    } catch {}
  },

  testChannel: async (id: string) => {
    try {
      await fetch(`/api/channels/${id}/test`, { method: 'POST' })
    } catch {}
  },
}))
