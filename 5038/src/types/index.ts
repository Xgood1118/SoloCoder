export interface Photo {
  id: string
  name: string
  url: string
  thumbnailUrl: string
  size: number
  takenAt: Date
  createdAt: Date
  updatedAt: Date
  tags: string[]
  albumIds: string[]
  location?: {
    lat: number
    lng: number
    address?: string
  }
  isDuplicate?: boolean
  duplicateGroupId?: string
  syncStatus: 'synced' | 'syncing' | 'conflict' | 'pending'
  deviceId?: string
  hash?: string
}

export interface Album {
  id: string
  name: string
  description?: string
  coverPhotoId?: string
  visibility: 'private' | 'team' | 'public'
  createdAt: Date
  updatedAt: Date
  photoCount: number
  sortBy: 'takenAt' | 'name' | 'size' | 'createdAt'
  sortOrder: 'asc' | 'desc'
  createdBy: string
  teamIds?: string[]
}

export interface Team {
  id: string
  name: string
  color: string
}

export interface SyncConflict {
  id: string
  photoId: string
  photoName: string
  devices: string[]
  createdAt: Date
  resolved: boolean
}

export type SortField = 'takenAt' | 'name' | 'size' | 'createdAt'
export type SortOrder = 'asc' | 'desc'

export interface BatchOperation {
  type: 'move' | 'addTag' | 'removeTag' | 'delete'
  targetAlbumId?: string
  tags?: string[]
}
