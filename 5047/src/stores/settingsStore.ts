import { create } from 'zustand'
import type { AudioQuality } from '@/types'

interface SettingsState {
  audioQuality: AudioQuality
  appleMusicConnected: boolean
  localFolders: string[]

  setAudioQuality: (quality: AudioQuality) => void
  setAppleMusicConnected: (connected: boolean) => void
  addLocalFolder: (folder: string) => void
  removeLocalFolder: (folder: string) => void
}

function loadSettings(): { audioQuality: AudioQuality; appleMusicConnected: boolean; localFolders: string[] } {
  try {
    const raw = localStorage.getItem('melodia-settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        audioQuality: parsed.audioQuality ?? 'high',
        appleMusicConnected: parsed.appleMusicConnected ?? false,
        localFolders: parsed.localFolders ?? [],
      }
    }
  } catch { /* ignore */ }
  return { audioQuality: 'high', appleMusicConnected: false, localFolders: [] }
}

function saveSettings(state: { audioQuality: AudioQuality; appleMusicConnected: boolean; localFolders: string[] }) {
  try {
    localStorage.setItem('melodia-settings', JSON.stringify(state))
  } catch { /* ignore */ }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadSettings(),

  setAudioQuality: (quality) => {
    set((state) => {
      const next = { ...state, audioQuality: quality }
      saveSettings(next)
      return { audioQuality: quality }
    })
  },

  setAppleMusicConnected: (connected) => {
    set((state) => {
      const next = { ...state, appleMusicConnected: connected }
      saveSettings(next)
      return { appleMusicConnected: connected }
    })
  },

  addLocalFolder: (folder) => {
    set((state) => {
      if (state.localFolders.includes(folder)) return state
      const next = { ...state, localFolders: [...state.localFolders, folder] }
      saveSettings(next)
      return { localFolders: next.localFolders }
    })
  },

  removeLocalFolder: (folder) => {
    set((state) => {
      const next = { ...state, localFolders: state.localFolders.filter((f) => f !== folder) }
      saveSettings(next)
      return { localFolders: next.localFolders }
    })
  },
}))
