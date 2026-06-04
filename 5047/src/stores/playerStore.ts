import { create } from 'zustand'
import type { Song, PlayMode } from '@/types'

interface PlayerState {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  volume: number
  playMode: PlayMode
  queue: Song[]
  queueIndex: number
  showQueue: boolean

  playSong: (song: Song, queue?: Song[]) => void
  togglePlay: () => void
  nextSong: () => void
  prevSong: () => void
  setCurrentTime: (time: number) => void
  setVolume: (volume: number) => void
  setPlayMode: (mode: PlayMode) => void
  toggleQueue: () => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  volume: 1,
  playMode: 'sequential',
  queue: [],
  queueIndex: -1,
  showQueue: false,

  playSong: (song, queue) => {
    if (queue) {
      const index = queue.findIndex((s) => s.id === song.id)
      set({
        currentSong: song,
        isPlaying: true,
        currentTime: 0,
        queue,
        queueIndex: index >= 0 ? index : 0,
      })
    } else {
      const { queue: currentQueue } = get()
      const existingIndex = currentQueue.findIndex((s) => s.id === song.id)
      if (existingIndex >= 0) {
        set({
          currentSong: song,
          isPlaying: true,
          currentTime: 0,
          queueIndex: existingIndex,
        })
      } else {
        set((state) => ({
          currentSong: song,
          isPlaying: true,
          currentTime: 0,
          queue: [...state.queue, song],
          queueIndex: state.queue.length,
        }))
      }
    }
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }))
  },

  nextSong: () => {
    const { queue, queueIndex, playMode } = get()
    if (queue.length === 0) return

    if (playMode === 'repeat-one') {
      set({ currentTime: 0, isPlaying: true })
      return
    }

    if (playMode === 'shuffle') {
      let nextIndex = queueIndex
      if (queue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * queue.length)
        } while (nextIndex === queueIndex)
      }
      set({
        currentSong: queue[nextIndex],
        queueIndex: nextIndex,
        currentTime: 0,
        isPlaying: true,
      })
      return
    }

    const nextIndex = (queueIndex + 1) % queue.length
    set({
      currentSong: queue[nextIndex],
      queueIndex: nextIndex,
      currentTime: 0,
      isPlaying: true,
    })
  },

  prevSong: () => {
    const { queue, queueIndex, playMode } = get()
    if (queue.length === 0) return

    if (playMode === 'repeat-one') {
      set({ currentTime: 0, isPlaying: true })
      return
    }

    if (playMode === 'shuffle') {
      let prevIndex = queueIndex
      if (queue.length > 1) {
        do {
          prevIndex = Math.floor(Math.random() * queue.length)
        } while (prevIndex === queueIndex)
      }
      set({
        currentSong: queue[prevIndex],
        queueIndex: prevIndex,
        currentTime: 0,
        isPlaying: true,
      })
      return
    }

    const prevIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1
    set({
      currentSong: queue[prevIndex],
      queueIndex: prevIndex,
      currentTime: 0,
      isPlaying: true,
    })
  },

  setCurrentTime: (time) => {
    set({ currentTime: time })
  },

  setVolume: (volume) => {
    set({ volume: Math.max(0, Math.min(1, volume)) })
  },

  setPlayMode: (mode) => {
    set({ playMode: mode })
  },

  toggleQueue: () => {
    set((state) => ({ showQueue: !state.showQueue }))
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get()
    if (index < 0 || index >= queue.length) return

    const newQueue = queue.filter((_, i) => i !== index)
    let newIndex = queueIndex

    if (index < queueIndex) {
      newIndex = queueIndex - 1
    } else if (index === queueIndex) {
      if (newQueue.length === 0) {
        set({ queue: [], queueIndex: -1, currentSong: null, isPlaying: false })
        return
      }
      newIndex = Math.min(index, newQueue.length - 1)
      set({
        queue: newQueue,
        queueIndex: newIndex,
        currentSong: newQueue[newIndex],
        currentTime: 0,
      })
      return
    }

    set({ queue: newQueue, queueIndex: newIndex })
  },

  clearQueue: () => {
    set({ queue: [], queueIndex: -1, currentSong: null, isPlaying: false, currentTime: 0 })
  },

  reorderQueue: (fromIndex, toIndex) => {
    const { queue, queueIndex } = get()
    if (
      fromIndex < 0 || fromIndex >= queue.length ||
      toIndex < 0 || toIndex >= queue.length ||
      fromIndex === toIndex
    ) return

    const newQueue = [...queue]
    const [moved] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, moved)

    let newIndex = queueIndex
    if (fromIndex === queueIndex) {
      newIndex = toIndex
    } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
      newIndex = queueIndex - 1
    } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
      newIndex = queueIndex + 1
    }

    set({ queue: newQueue, queueIndex: newIndex })
  },
}))
