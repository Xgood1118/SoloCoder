import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { Photo, Album, SyncConflict, SortField, SortOrder } from '../types'
import { photos as initialPhotos, albums as initialAlbums, syncConflicts as initialConflicts, allTags as initialTags } from '../data/mockData'

interface AppState {
  photos: Photo[]
  albums: Album[]
  selectedPhotoIds: Set<string>
  currentAlbumId: string | null
  sortField: SortField
  sortOrder: SortOrder
  searchQuery: string
  filterTags: string[]
  syncConflicts: SyncConflict[]
  allTags: string[]
  viewMode: 'grid' | 'map'
}

interface AppContextType extends AppState {
  selectPhoto: (id: string, multi?: boolean) => void
  selectAllPhotos: (ids: string[]) => void
  clearSelection: () => void
  setCurrentAlbum: (id: string | null) => void
  setSortField: (field: SortField) => void
  setSortOrder: (order: SortOrder) => void
  setSearchQuery: (query: string) => void
  toggleFilterTag: (tag: string) => void
  movePhotosToAlbum: (photoIds: string[], albumId: string) => void
  addTagsToPhotos: (photoIds: string[], tags: string[]) => void
  deletePhotos: (photoIds: string[]) => void
  createAlbum: (album: Omit<Album, 'id'>) => void
  updateAlbum: (id: string, updates: Partial<Album>) => void
  deleteAlbum: (id: string) => void
  resolveConflict: (conflictId: string, keepDevice: string) => void
  setViewMode: (mode: 'grid' | 'map') => void
  filteredPhotos: Photo[]
  currentAlbum: Album | undefined
  duplicateGroups: Map<string, Photo[]>
}

const AppContext = createContext<AppContextType | null>(null)

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [albums, setAlbums] = useState<Album[]>(initialAlbums)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('takenAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>(initialConflicts)
  const [allTags] = useState<string[]>(initialTags)
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')

  const selectPhoto = useCallback((id: string, multi = false) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      } else {
        if (next.size === 1 && next.has(id)) next.clear()
        else { next.clear(); next.add(id) }
      }
      return next
    })
  }, [])

  const selectAllPhotos = useCallback((ids: string[]) => {
    setSelectedPhotoIds(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPhotoIds(new Set())
  }, [])

  const setCurrentAlbum = useCallback((id: string | null) => {
    setCurrentAlbumId(id)
    if (id) {
      const album = albums.find(a => a.id === id)
      if (album) {
        setSortField(album.sortBy)
        setSortOrder(album.sortOrder)
      }
    }
    setSelectedPhotoIds(new Set())
  }, [albums])

  const toggleFilterTag = useCallback((tag: string) => {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  const movePhotosToAlbum = useCallback((photoIds: string[], albumId: string) => {
    setPhotos(prev => prev.map(p =>
      photoIds.includes(p.id)
        ? { ...p, albumIds: [...new Set([...p.albumIds, albumId])] }
        : p
    ))
    setSelectedPhotoIds(new Set())
  }, [])

  const addTagsToPhotos = useCallback((photoIds: string[], tags: string[]) => {
    setPhotos(prev => prev.map(p =>
      photoIds.includes(p.id)
        ? { ...p, tags: [...new Set([...p.tags, ...tags])] }
        : p
    ))
  }, [])

  const deletePhotos = useCallback((photoIds: string[]) => {
    setPhotos(prev => prev.filter(p => !photoIds.includes(p.id)))
    setSelectedPhotoIds(new Set())
  }, [])

  const createAlbum = useCallback((album: Omit<Album, 'id'>) => {
    const newAlbum: Album = { ...album, id: `a${Date.now()}` }
    setAlbums(prev => [...prev, newAlbum])
  }, [])

  const updateAlbum = useCallback((id: string, updates: Partial<Album>) => {
    setAlbums(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }, [])

  const deleteAlbum = useCallback((id: string) => {
    setAlbums(prev => prev.filter(a => a.id !== id))
    setPhotos(prev => prev.map(p => ({
      ...p,
      albumIds: p.albumIds.filter(aid => aid !== id)
    })))
    if (currentAlbumId === id) setCurrentAlbumId(null)
  }, [currentAlbumId])

  const resolveConflict = useCallback((conflictId: string, _keepDevice: string) => {
    setSyncConflicts(prev => prev.map(c =>
      c.id === conflictId ? { ...c, resolved: true } : c
    ))
  }, [])

  const filteredPhotos = useMemo(() => {
    let result = [...photos]

    if (currentAlbumId) {
      result = result.filter(p => p.albumIds.includes(currentAlbumId))
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      )
    }

    if (filterTags.length > 0) {
      result = result.filter(p =>
        filterTags.every(t => p.tags.includes(t))
      )
    }

    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'takenAt':
          comparison = a.takenAt.getTime() - b.takenAt.getTime()
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [photos, currentAlbumId, searchQuery, filterTags, sortField, sortOrder])

  const currentAlbum = useMemo(() =>
    albums.find(a => a.id === currentAlbumId),
    [albums, currentAlbumId]
  )

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, Photo[]>()
    photos.forEach(p => {
      if (p.duplicateGroupId) {
        const group = groups.get(p.duplicateGroupId) || []
        group.push(p)
        groups.set(p.duplicateGroupId, group)
      }
    })
    return groups
  }, [photos])

  return (
    <AppContext.Provider value={{
      photos,
      albums,
      selectedPhotoIds,
      currentAlbumId,
      sortField,
      sortOrder,
      searchQuery,
      filterTags,
      syncConflicts,
      allTags,
      viewMode,
      selectPhoto,
      selectAllPhotos,
      clearSelection,
      setCurrentAlbum,
      setSortField,
      setSortOrder,
      setSearchQuery,
      toggleFilterTag,
      movePhotosToAlbum,
      addTagsToPhotos,
      deletePhotos,
      createAlbum,
      updateAlbum,
      deleteAlbum,
      resolveConflict,
      setViewMode,
      filteredPhotos,
      currentAlbum,
      duplicateGroups,
    }}>
      {children}
    </AppContext.Provider>
  )
}
