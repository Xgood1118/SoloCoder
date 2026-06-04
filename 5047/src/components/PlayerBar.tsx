import { useRef } from 'react'
import {
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Heart,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  ListMusic,
} from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PlayerBar() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    volume,
    playMode,
    togglePlay,
    nextSong,
    prevSong,
    setCurrentTime,
    setVolume,
    setPlayMode,
    toggleQueue,
  } = usePlayerStore()

  const { toggleFavorite, isFavorite } = useLibraryStore()
  const progressRef = useRef<HTMLInputElement>(null)

  const duration = currentSong?.duration ?? 0
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const favorited = currentSong ? isFavorite(currentSong.id) : false

  const cyclePlayMode = () => {
    const modes: Array<'sequential' | 'shuffle' | 'repeat-one'> = ['sequential', 'shuffle', 'repeat-one']
    const idx = modes.indexOf(playMode)
    setPlayMode(modes[(idx + 1) % modes.length])
  }

  const handleProgressClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setCurrentTime(val)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value))
  }

  const PlayModeIcon = playMode === 'repeat-one' ? Repeat1 : playMode === 'shuffle' ? Shuffle : Repeat

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-charcoal/90 backdrop-blur-xl border-t border-white/5 z-40 flex items-center px-4 gap-4">
      {/* Left: Song info */}
      <div className="flex items-center gap-3 w-64 shrink-0">
        {currentSong ? (
          <>
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className={`w-12 h-12 rounded-lg object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-body truncate">{currentSong.title}</p>
              <p className="text-xs text-zinc-400 font-body truncate">{currentSong.artist}</p>
            </div>
            <button
              onClick={() => currentSong && toggleFavorite(currentSong.id)}
              className="shrink-0 p-1.5 text-zinc-400 hover:text-coral transition-colors"
            >
              <Heart className={`w-4.5 h-4.5 ${favorited ? 'fill-coral text-coral' : ''}`} />
            </button>
          </>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/5 shrink-0" />
        )}
      </div>

      {/* Center: Controls + Progress */}
      <div className="flex-1 flex flex-col items-center gap-1 max-w-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={cyclePlayMode}
            className={`p-1.5 transition-colors ${playMode !== 'sequential' ? 'text-amber' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <PlayModeIcon className="w-4 h-4" />
          </button>
          <button onClick={prevSong} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-amber text-midnight flex items-center justify-center hover:bg-amber-light transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={nextSong} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
          <div className="w-6" />
        </div>

        <div className="flex items-center gap-2 w-full">
          <span className="text-[11px] text-zinc-500 font-body w-10 text-right tabular-nums">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative group">
            <input
              ref={progressRef}
              type="range"
              min={0}
              max={duration || 1}
              value={currentTime}
              onChange={handleProgressClick}
              className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber
                [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:group-hover:opacity-100
                [&::-webkit-slider-thumb]:transition-opacity"
              style={{
                background: `linear-gradient(to right, #D4A853 ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
              }}
            />
          </div>
          <span className="text-[11px] text-zinc-500 font-body w-10 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Volume + Queue */}
      <div className="flex items-center gap-3 w-64 shrink-0 justify-end">
        <Volume2 className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          className="w-24 h-1 appearance-none bg-white/10 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber"
          style={{
            background: `linear-gradient(to right, #D4A853 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
          }}
        />
        <button
          onClick={toggleQueue}
          className="p-2 text-zinc-400 hover:text-amber transition-colors"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
