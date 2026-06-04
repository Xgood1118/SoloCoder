import { useState } from 'react'
import { Library as LibraryIcon, Users, Disc3, Music, Clock, Heart, ListPlus, Play } from 'lucide-react'
import { songs, artists, albums } from '@/data/mockData'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import type { LibraryTab, Song } from '@/types'

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function SongRow({ song }: { song: Song }) {
  const playSong = usePlayerStore(s => s.playSong)
  const toggleFavorite = useLibraryStore(s => s.toggleFavorite)
  const isFavorite = useLibraryStore(s => s.isFavorite)
  const favorited = isFavorite(song.id)

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors group">
      <img
        src={song.coverUrl}
        alt={song.title}
        className="w-10 h-10 rounded-lg object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{song.title}</p>
        <p className="text-zinc-500 text-xs truncate">{song.artist}</p>
      </div>
      <span className="text-zinc-500 text-sm hidden md:block w-32 truncate">{song.album}</span>
      <span className="text-zinc-500 text-xs w-12 text-right tabular-nums shrink-0">
        {formatTime(song.duration)}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => toggleFavorite(song.id)}
          className="p-1.5 hover:text-amber transition-colors"
        >
          <Heart className={`w-4 h-4 ${favorited ? 'fill-coral text-coral' : ''}`} />
        </button>
        <button
          onClick={() => playSong(song, songs)}
          className="p-1.5 hover:text-amber transition-colors"
        >
          <Play className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ArtistsView() {
  return (
    <div className="grid grid-cols-4 gap-6">
      {artists.map((artist) => (
        <div
          key={artist.id}
          className="glass-card-hover p-5 text-center cursor-pointer"
        >
          <img
            src={artist.avatarUrl}
            alt={artist.name}
            className="w-24 h-24 rounded-full object-cover mx-auto shadow-lg"
          />
          <h3 className="font-display font-semibold text-white mt-3">
            {artist.name}
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            {artist.albumCount} 张专辑 · {artist.songCount} 首歌曲
          </p>
        </div>
      ))}
    </div>
  )
}

function AlbumsView() {
  const playSong = usePlayerStore(s => s.playSong)

  return (
    <div className="grid grid-cols-3 gap-6">
      {albums.map((album) => {
        const albumSongs = songs.filter(s => s.albumId === album.id)
        return (
          <div
            key={album.id}
            className="glass-card-hover group cursor-pointer overflow-hidden"
            onClick={() => albumSongs[0] && playSong(albumSongs[0], albumSongs)}
          >
            <div className="relative">
              <img
                src={album.coverUrl}
                alt={album.title}
                className="w-full aspect-square object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                <div className="w-12 h-12 rounded-full bg-amber flex items-center justify-center text-midnight">
                  <Play className="w-6 h-6 ml-0.5" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-display font-semibold text-white truncate">
                {album.title}
              </h3>
              <p className="text-zinc-400 text-sm">{album.artist}</p>
              <p className="text-zinc-500 text-xs mt-1">
                {album.songCount} 首 · {album.year}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SongsView() {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4 px-4 py-2 text-zinc-500 text-xs font-medium border-b border-white/5">
        <span className="w-10 shrink-0"></span>
        <span className="flex-1">歌曲</span>
        <span className="w-32 shrink-0 hidden md:block">专辑</span>
        <span className="w-12 text-right shrink-0">时长</span>
        <span className="w-16 shrink-0"></span>
      </div>
      {songs.map((song) => (
        <SongRow key={song.id} song={song} />
      ))}
    </div>
  )
}

function DurationView() {
  const longSongs = songs.filter(s => s.duration >= 300)
  const mediumSongs = songs.filter(s => s.duration >= 180 && s.duration < 300)
  const shortSongs = songs.filter(s => s.duration < 180)

  return (
    <div className="space-y-8">
      {longSongs.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-white mb-4">5 分钟以上</h3>
          <div className="space-y-1">
            {longSongs.map((song) => (
              <SongRow key={song.id} song={song} />
            ))}
          </div>
        </div>
      )}
      {mediumSongs.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-white mb-4">3-5 分钟</h3>
          <div className="space-y-1">
            {mediumSongs.map((song) => (
              <SongRow key={song.id} song={song} />
            ))}
          </div>
        </div>
      )}
      {shortSongs.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-white mb-4">3 分钟以下</h3>
          <div className="space-y-1">
            {shortSongs.map((song) => (
              <SongRow key={song.id} song={song} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Library() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('songs')

  const tabs: { key: LibraryTab; label: string; icon: typeof Users }[] = [
    { key: 'artists', label: '歌手', icon: Users },
    { key: 'albums', label: '专辑', icon: Disc3 },
    { key: 'songs', label: '歌曲', icon: Music },
    { key: 'duration', label: '时长', icon: Clock },
  ]

  return (
    <div className="p-6 pb-32 overflow-y-auto h-full animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <LibraryIcon className="w-8 h-8 text-amber" />
        <h1 className="font-display text-3xl font-bold text-gradient-amber">音乐库</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-2 mb-8">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === key
                ? 'bg-amber text-midnight font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'artists' && <ArtistsView />}
      {activeTab === 'albums' && <AlbumsView />}
      {activeTab === 'songs' && <SongsView />}
      {activeTab === 'duration' && <DurationView />}
    </div>
  )
}
