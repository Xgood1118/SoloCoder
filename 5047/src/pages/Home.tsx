import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home as HomeIcon, Music, Clock, Disc, Play, Heart, ChevronRight } from 'lucide-react'
import { songs, defaultPlaylists } from '@/data/mockData'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const RECENT_KEY = 'melodia-recent-plays'

const getRecentPlays = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

const addRecentPlay = (songId: string) => {
  try {
    const recent = getRecentPlays().filter(id => id !== songId)
    recent.unshift(songId)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
  } catch {}
}

export function useRecentPlays() {
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => {
    setRecentIds(getRecentPlays())
  }, [])

  const addToRecent = (songId: string) => {
    addRecentPlay(songId)
    setRecentIds(getRecentPlays())
  }

  const recentSongs = recentIds
    .map(id => songs.find(s => s.id === id))
    .filter(Boolean)
    .slice(0, 6)

  return { recentSongs, addToRecent }
}

export default function Home() {
  const navigate = useNavigate()
  const playSong = usePlayerStore(s => s.playSong)
  const toggleFavorite = useLibraryStore(s => s.toggleFavorite)
  const isFavorite = useLibraryStore(s => s.isFavorite)
  const { recentSongs, addToRecent } = useRecentPlays()

  const handlePlaySong = (song: typeof songs[0], queue?: typeof songs) => {
    playSong(song, queue || [song])
    addToRecent(song.id)
  }

  return (
    <div className="p-6 pb-32 overflow-y-auto h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <HomeIcon className="w-8 h-8 text-amber" />
        <h1 className="font-display text-3xl font-bold text-gradient-amber">发现音乐</h1>
      </div>

      {/* Hero Section */}
      <div className="glass-card p-8 mb-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber/10 to-transparent" />
        <div className="relative z-10">
          <h2 className="font-display text-2xl font-bold text-white mb-2">
            下午好，开始你的音乐之旅
          </h2>
          <p className="text-zinc-400 mb-6">
            探索精选歌单，发现新的音乐灵感
          </p>
          <button
            onClick={() => handlePlaySong(songs[0], songs)}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            随机播放
          </button>
        </div>
        <Disc className="absolute right-10 top-1/2 -translate-y-1/2 w-40 h-40 text-amber/10 animate-spin-slow" />
      </div>

      {/* Recommended Playlists */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-semibold text-white">推荐歌单</h3>
          <button
            onClick={() => navigate('/playlists')}
            className="flex items-center gap-1 text-sm text-amber hover:underline transition-colors"
          >
            查看全部 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {defaultPlaylists.map((playlist) => {
            const playlistSongs = playlist.songs
              .map(id => songs.find(s => s.id === id))
              .filter(Boolean)
            const coverSong = playlistSongs[0]

            return (
              <div
                key={playlist.id}
                className="glass-card-hover cursor-pointer group"
                onClick={() => navigate(`/playlists/${playlist.id}`)}
              >
                <div className="relative">
                  <img
                    src={coverSong?.coverUrl || playlist.coverUrl}
                    alt={playlist.name}
                    className="w-full aspect-video object-cover rounded-t-2xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl flex items-end justify-center pb-6">
                    <div
                      className="w-12 h-12 rounded-full bg-amber flex items-center justify-center text-midnight"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (playlistSongs[0]) {
                          handlePlaySong(playlistSongs[0]!, playlistSongs as typeof songs)
                        }
                      }}
                    >
                      <Play className="w-6 h-6 ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="font-display font-semibold text-white truncate">
                    {playlist.name}
                  </h4>
                  <p className="text-zinc-500 text-sm mt-1 line-clamp-2">
                    {playlist.description}
                  </p>
                  <p className="text-zinc-600 text-xs mt-2">
                    {playlist.songs.length} 首歌曲
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recently Played */}
      {recentSongs.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-5 h-5 text-amber" />
            <h3 className="font-display text-lg font-semibold text-white">最近播放</h3>
          </div>
          <div className="glass-card p-2">
            {recentSongs.map((song) => (
              <div
                key={song!.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors group"
              >
                <img
                  src={song!.coverUrl}
                  alt={song!.title}
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{song!.title}</p>
                  <p className="text-zinc-500 text-sm truncate">{song!.artist}</p>
                </div>
                <span className="text-zinc-500 text-xs tabular-nums">
                  {formatTime(song!.duration)}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleFavorite(song!.id)}
                    className="p-1.5 hover:text-amber transition-colors"
                  >
                    <Heart className={`w-4 h-4 ${isFavorite(song!.id) ? 'fill-coral text-coral' : ''}`} />
                  </button>
                  <button
                    onClick={() => handlePlaySong(song!)}
                    className="p-1.5 hover:text-amber transition-colors"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular Songs */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <Music className="w-5 h-5 text-amber" />
          <h3 className="font-display text-lg font-semibold text-white">热门歌曲</h3>
        </div>
        <div className="space-y-1">
          {songs.slice(0, 8).map((song, index) => (
            <div
              key={song.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors group"
            >
              <span className="w-6 text-center text-zinc-500 text-sm tabular-nums">
                {index + 1}
              </span>
              <img
                src={song.coverUrl}
                alt={song.title}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{song.title}</p>
                <p className="text-zinc-500 text-sm truncate">{song.artist}</p>
              </div>
              <span className="text-zinc-500 text-xs tabular-nums">
                {formatTime(song.duration)}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleFavorite(song.id)}
                  className="p-1.5 hover:text-amber transition-colors"
                >
                  <Heart className={`w-4 h-4 ${isFavorite(song.id) ? 'fill-coral text-coral' : ''}`} />
                </button>
                <button
                  onClick={() => handlePlaySong(song, songs)}
                  className="p-1.5 hover:text-amber transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
