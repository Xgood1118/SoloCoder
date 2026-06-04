import { create } from 'zustand'
import type { Playlist } from '@/types'

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return fallback
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

interface LibraryState {
  favorites: string[]
  playlists: Playlist[]

  toggleFavorite: (songId: string) => void
  isFavorite: (songId: string) => boolean
  createPlaylist: (name: string, description: string, coverUrl: string) => void
  deletePlaylist: (id: string) => void
  updatePlaylist: (id: string, data: Partial<Pick<Playlist, 'name' | 'description' | 'coverUrl'>>) => void
  addToPlaylist: (playlistId: string, songId: string) => void
  removeFromPlaylist: (playlistId: string, songId: string) => void
  reorderPlaylistSongs: (playlistId: string, fromIndex: number, toIndex: number) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  favorites: loadFromStorage<string[]>('melodia-favorites', []),
  playlists: loadFromStorage<Playlist[]>('melodia-playlists', []),

  toggleFavorite: (songId) => {
    set((state) => {
      const exists = state.favorites.includes(songId)
      const next = exists
        ? state.favorites.filter((id) => id !== songId)
        : [...state.favorites, songId]
      saveToStorage('melodia-favorites', next)
      return { favorites: next }
    })
  },

  isFavorite: (songId) => {
    return get().favorites.includes(songId)
  },

  createPlaylist: (name, description, coverUrl) => {
    const now = Date.now()
    const playlist: Playlist = {
      id: now.toString(),
      name,
      description,
      coverUrl,
      songs: [],
      createdAt: now,
      updatedAt: now,
    }
    set((state) => {
      const next = [...state.playlists, playlist]
      saveToStorage('melodia-playlists', next)
      return { playlists: next }
    })
  },

  deletePlaylist: (id) => {
    set((state) => {
      const next = state.playlists.filter((p) => p.id !== id)
      saveToStorage('melodia-playlists', next)
      return { playlists: next }
    })
  },

  updatePlaylist: (id, data) => {
    set((state) => {
      const next = state.playlists.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
      )
      saveToStorage('melodia-playlists', next)
      return { playlists: next }
    })
  },

  addToPlaylist: (playlistId, songId) => {
    set((state) => {
      const next = state.playlists.map((p) => {
        if (p.id !== playlistId) return p
        if (p.songs.includes(songId)) return p
        return { ...p, songs: [...p.songs, songId], updatedAt: Date.now() }
      })
      saveToStorage('melodia-playlists', next)
      return { playlists: next }
    })
  },

  removeFromPlaylist: (playlistId, songId) => {
    set((state) => {
      const next = state.playlists.map((p) => {
        if (p.id !== playlistId) return p
        return { ...p, songs: p.songs.filter((id) => id !== songId), updatedAt: Date.now() }
      })
      saveToStorage('melodia-playlists', next)
      return { playlists: next }
    })
  },

  reorderPlaylistSongs: (playlistId, fromIndex, toIndex) => {
    set((state) => {
      const next = state.playlists.map((p) => {
        if (p.id !== playlistId) return p
        if (
          fromIndex < 0 || fromIndex >= p.songs.length ||
          toIndex < 0 || toIndex >= p.songs.length ||
          fromIndex === toIndex
        ) return p
        const ids = [...p.songs]
        const [moved] = ids.splice(fromIndex, 1)
        ids.splice(toIndex, 0, moved)
        return { ...p, songs: ids, updatedAt: Date.now() }
      })
      saveToStorage('melodia-playlists', next)
      return { playlists: next }
    })
  },
}))
