import { useEffect } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { songs } from '@/data/mockData'

export function useAudioPlayer() {
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)
  const nextSong = usePlayerStore((s) => s.nextSong)

  useEffect(() => {
    if (!isPlaying || !currentSong) return

    const duration = songs.find((s) => s.id === currentSong.id)?.duration ?? currentSong.duration

    const timer = setInterval(() => {
      const next = currentTime + 0.25
      if (next >= duration) {
        nextSong()
      } else {
        setCurrentTime(next)
      }
    }, 250)

    return () => clearInterval(timer)
  }, [isPlaying, currentSong, currentTime, setCurrentTime, nextSong])
}
