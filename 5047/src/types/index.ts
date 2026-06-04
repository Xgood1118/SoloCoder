export interface Song {
  id: string
  title: string
  artist: string
  artistId: string
  album: string
  albumId: string
  duration: number
  coverUrl: string
  audioUrl: string
  lrcLyric?: string
  quality: 'high' | 'medium' | 'standard'
  source: 'local' | 'apple-music' | 'mock'
}

export interface Artist {
  id: string
  name: string
  avatarUrl: string
  albumCount: number
  songCount: number
}

export interface Album {
  id: string
  title: string
  artist: string
  artistId: string
  coverUrl: string
  songCount: number
  year: number
}

export interface Playlist {
  id: string
  name: string
  description: string
  coverUrl: string
  songs: string[]
  createdAt: number
  updatedAt: number
}

export interface LrcLine {
  time: number
  text: string
}

export type PlayMode = 'sequential' | 'shuffle' | 'repeat-one'
export type AudioQuality = 'high' | 'medium' | 'standard'
export type LibraryTab = 'artists' | 'albums' | 'songs' | 'duration'
export type SearchResult = { songs: Song[]; artists: Artist[]; albums: Album[] }
