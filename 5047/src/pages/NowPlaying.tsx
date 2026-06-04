import { useMemo, useRef, useEffect, useCallback } from 'react'
import { Music, Heart, Disc, Globe, HardDrive } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import type { LrcLine, Song } from '@/types'

const parseLrc = (lrc: string): LrcLine[] => {
  const lines = lrc.split('\n')
  const result: LrcLine[] = []
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const ms = parseInt(match[3].padEnd(3, '0'))
      const text = match[4].trim()
      if (text) {
        result.push({ time: minutes * 60 + seconds + ms / 1000, text })
      }
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

export default function NowPlaying() {
  const { currentSong, isPlaying, currentTime, playSong, queue } = usePlayerStore()
  const { toggleFavorite, isFavorite } = useLibraryStore()
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLParagraphElement>(null)

  const lyrics = useMemo(() => {
    return currentSong?.lrcLyric ? parseLrc(currentSong.lrcLyric) : []
  }, [currentSong?.lrcLyric])

  const activeLineIndex = useMemo(() => {
    if (lyrics.length === 0) return -1
    let idx = -1
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        idx = i
      } else {
        break
      }
    }
    return idx
  }, [currentTime, lyrics])

  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLineIndex])

  const handleLineClick = useCallback((time: number) => {
    usePlayerStore.getState().setCurrentTime(time)
  }, [])

  const getSourceIcon = (source: Song['source']) => {
    switch (source) {
      case 'apple-music':
        return <Globe className="w-3.5 h-3.5" />
      case 'local':
        return <HardDrive className="w-3.5 h-3.5" />
      default:
        return <Music className="w-3.5 h-3.5" />
    }
  }

  const getSourceLabel = (source: Song['source']) => {
    switch (source) {
      case 'apple-music': return 'Apple Music'
      case 'local': return '本地'
      default: return '内置'
    }
  }

  const favorited = currentSong ? isFavorite(currentSong.id) : false

  if (!currentSong) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8">
        <Disc className="w-20 h-20 mb-6 opacity-20" />
        <p className="text-xl font-display">选择一首歌曲开始播放</p>
        <p className="text-sm mt-2 opacity-60">从音乐库或歌单中选择歌曲</p>
      </div>
    )
  }

  return (
    <div className="flex h-full p-8 gap-12">
      {/* Left Section: Album Cover + Song Info */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative mb-8">
          <img
            src={currentSong.coverUrl}
            alt={currentSong.title}
            className="w-72 h-72 rounded-2xl object-cover shadow-2xl amber-glow-strong"
            style={{
              animation: isPlaying ? 'spin 12s linear infinite' : 'none',
            }}
          />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-midnight/50 to-transparent pointer-events-none" />
        </div>

        <h2 className="font-display text-2xl font-bold text-white text-center">
          {currentSong.title}
        </h2>
        <p className="text-zinc-400 font-body mt-1">{currentSong.artist}</p>

        <div className="flex items-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-zinc-400 text-xs">
            {getSourceIcon(currentSong.source)}
            {getSourceLabel(currentSong.source)}
          </span>
          <button
            onClick={() => toggleFavorite(currentSong.id)}
            className={`p-2 rounded-full transition-colors ${favorited ? 'text-coral' : 'text-zinc-500 hover:text-coral'}`}
          >
            <Heart className={`w-5 h-5 ${favorited ? 'fill-coral' : ''}`} />
          </button>
        </div>

        {queue.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-zinc-500 text-sm">
              播放队列: <span className="text-amber">{queue.length}</span> 首歌曲
            </p>
          </div>
        )}
      </div>

      {/* Right Section: Lyrics Panel */}
      <div className="w-[420px] glass-card p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-5">
          <Music className="w-5 h-5 text-amber" />
          <h3 className="font-display font-semibold text-white">歌词</h3>
        </div>

        <div
          ref={lyricsContainerRef}
          className="flex-1 overflow-y-auto scroll-smooth"
        >
          {lyrics.length > 0 ? (
            <div className="space-y-1 py-4">
              {lyrics.map((line, idx) => (
                <p
                  key={idx}
                  ref={idx === activeLineIndex ? activeLineRef : null}
                  onClick={() => handleLineClick(line.time)}
                  className={`px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 ${
                    idx === activeLineIndex
                      ? 'text-amber text-lg font-semibold scale-105 bg-amber/5'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
              <Disc className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">暂无歌词</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
