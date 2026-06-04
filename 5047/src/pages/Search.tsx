import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, X, Music, Users, Disc3, Play, Heart, Clock } from 'lucide-react'
import { songs, artists, albums } from '@/data/mockData'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import type { Song } from '@/types'

const fuzzyMatch = (text: string, query: string): boolean => {
  const t = text.toLowerCase(), q = query.toLowerCase()
  if (t.includes(q)) return true
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti)
    if (idx === -1) return false
    ti = idx + 1
  }
  return true
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const HIST_KEY = 'melodia-search-history'
const getHistory = (): string[] => { try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]') } catch { return [] } }
const addHistory = (t: string) => { const h = getHistory().filter(x => x !== t); h.unshift(t); localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 10))) }
const clearHistory = () => localStorage.removeItem(HIST_KEY)
const hotSearches = ['孤勇者', '周杰伦', '七里香', '陈奕迅', 'Taylor Swift', '泡沫', 'Adele', '简单爱', 'Coldplay', '林俊杰']

export default function Search() {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<string[]>(getHistory())
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const playSong = usePlayerStore(s => s.playSong)
  const toggleFav = useLibraryStore(s => s.toggleFavorite)
  const isFav = useLibraryStore(s => s.isFavorite)
  useNavigate()

  const q = text.trim()
  const mSongs = q ? songs.filter(s => fuzzyMatch(s.title, q) || fuzzyMatch(s.artist, q) || fuzzyMatch(s.album, q)) : []
  const mArtists = q ? artists.filter(a => fuzzyMatch(a.name, q)) : []
  const mAlbums = q ? albums.filter(a => fuzzyMatch(a.title, q) || fuzzyMatch(a.artist, q)) : []
  const sSongs = mSongs.slice(0, 5), sArtists = mArtists.slice(0, 5), sAlbums = mAlbums.slice(0, 5)
  const showDrop = focused && q.length > 0 && (sSongs.length + sArtists.length + sAlbums.length) > 0
  const hasResults = mSongs.length + mArtists.length + mAlbums.length > 0

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node) && e.target !== inputRef.current) setFocused(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const doSearch = (term: string) => { setText(term); addHistory(term); setHistory(getHistory()); inputRef.current?.focus() }
  const doPlay = (song: Song) => { playSong(song, mSongs.length > 0 ? mSongs : [song]); addHistory(q); setHistory(getHistory()) }

  const pillCls = "px-4 py-1.5 rounded-full bg-charcoal/60 border border-white/5 text-sm text-zinc-300 hover:text-amber hover:border-amber/30 transition-all"
  const sugCls = "flex items-center gap-3 w-full px-2 py-2 hover:bg-white/5 rounded-lg transition-colors"

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <SearchIcon size={28} className="text-amber" />
        <h1 className="font-display text-3xl font-bold text-gradient-amber">搜索</h1>
      </div>

      <div className="relative" ref={dropRef}>
        <div className="relative">
          <SearchIcon size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} onFocus={() => setFocused(true)}
            placeholder="搜索歌曲、歌手、专辑..." className="input-dark w-full text-lg py-4 pl-14 pr-12" />
          {text && <button onClick={() => { setText(''); inputRef.current?.focus() }}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>}
        </div>

        {showDrop && (
          <div className="absolute z-50 left-0 right-0 top-full mt-2 glass-card max-h-80 overflow-y-auto p-3 space-y-3">
            <p className="text-zinc-500 text-sm px-2">搜索建议</p>
            {sSongs.length > 0 && <div><p className="text-zinc-600 text-xs px-2 mb-1">歌曲</p>
              {sSongs.map(s => <button key={s.id} onClick={() => { doPlay(s); setFocused(false) }} className={sugCls}>
                <Music size={14} className="text-amber shrink-0" /><span className="text-white text-sm truncate">{s.title}</span>
                <span className="text-zinc-600 text-xs ml-auto shrink-0">歌曲</span></button>)}</div>}
            {sArtists.length > 0 && <div><p className="text-zinc-600 text-xs px-2 mb-1">歌手</p>
              {sArtists.map(a => <button key={a.id} onClick={() => { doSearch(a.name); setFocused(false) }} className={sugCls}>
                <Users size={14} className="text-amber shrink-0" /><span className="text-white text-sm truncate">{a.name}</span>
                <span className="text-zinc-600 text-xs ml-auto shrink-0">歌手</span></button>)}</div>}
            {sAlbums.length > 0 && <div><p className="text-zinc-600 text-xs px-2 mb-1">专辑</p>
              {sAlbums.map(a => <button key={a.id} onClick={() => { doSearch(a.title); setFocused(false) }} className={sugCls}>
                <Disc3 size={14} className="text-amber shrink-0" /><span className="text-white text-sm truncate">{a.title}</span>
                <span className="text-zinc-600 text-xs ml-auto shrink-0">专辑</span></button>)}</div>}
          </div>
        )}
      </div>

      {!q && (<div className="space-y-8">
        <div><h2 className="font-display text-lg font-semibold text-white mb-3">热门搜索</h2>
          <div className="flex flex-wrap gap-2">{hotSearches.map(t => <button key={t} onClick={() => doSearch(t)} className={pillCls}>{t}</button>)}</div></div>
        {history.length > 0 && <div><div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-white">搜索历史</h2>
          <button onClick={() => { clearHistory(); setHistory([]) }} className="text-xs text-zinc-500 hover:text-amber transition-colors">清除</button></div>
          <div className="flex flex-wrap gap-2">{history.map(t => <button key={t} onClick={() => doSearch(t)} className={pillCls}>
            <Clock size={12} />{t}</button>)}</div></div>}
      </div>)}

      {q && !hasResults && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <SearchIcon size={48} className="mb-4 opacity-30" />
          <p className="text-lg">未找到与「{q}」相关的结果</p>
          <p className="text-sm mt-1">试试其他关键词吧</p>
        </div>
      )}

      {q && hasResults && (<div className="space-y-8">
        {mSongs.length > 0 && <div><h2 className="font-display text-lg font-semibold text-white mb-3">歌曲 ({mSongs.length})</h2>
          <div className="space-y-1">{mSongs.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors group">
              <img src={s.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{s.title}</p><p className="text-zinc-500 text-xs truncate">{s.artist}</p></div>
              <span className="text-zinc-600 text-xs hidden sm:block">{s.album}</span>
              <span className="text-zinc-600 text-xs w-10 text-right">{fmt(s.duration)}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => toggleFav(s.id)} className="p-1.5 hover:text-amber transition-colors"><Heart size={14} className={isFav(s.id) ? 'fill-coral text-coral' : ''} /></button>
                <button onClick={() => doPlay(s)} className="p-1.5 hover:text-amber transition-colors"><Play size={14} /></button>
              </div></div>))}</div></div>}
        {mArtists.length > 0 && <div><h2 className="font-display text-lg font-semibold text-white mb-3">歌手 ({mArtists.length})</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">{mArtists.map(a => (
            <button key={a.id} onClick={() => doSearch(a.name)} className="flex flex-col items-center gap-2 w-32 shrink-0 hover:opacity-80 transition-opacity">
              <img src={a.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
              <span className="text-white text-sm truncate w-full text-center">{a.name}</span></button>))}</div></div>}
        {mAlbums.length > 0 && <div><h2 className="font-display text-lg font-semibold text-white mb-3">专辑 ({mAlbums.length})</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">{mAlbums.map(a => (
            <button key={a.id} onClick={() => doSearch(a.title)} className="flex flex-col gap-2 w-40 shrink-0 hover:opacity-80 transition-opacity">
              <img src={a.coverUrl} alt="" className="w-40 h-40 rounded-xl object-cover" />
              <p className="text-white text-sm truncate">{a.title}</p>
              <p className="text-zinc-500 text-xs truncate">{a.artist}</p></button>))}</div></div>}
      </div>)}
    </div>
  )
}
