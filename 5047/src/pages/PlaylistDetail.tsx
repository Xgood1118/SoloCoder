import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Heart, Trash2, Image, Edit3, ArrowUp, ArrowDown, X, Clock } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { songs as allSongs } from '@/data/mockData'
import type { Song } from '@/types'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN')
}

function InlineEdit({ value, onSave, className }: {
  value: string; onSave: (v: string) => void; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    if (draft.trim()) onSave(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className="input-dark px-2 py-1 text-inherit font-inherit bg-transparent w-full"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  return (
    <span className={`cursor-pointer hover:text-amber transition-colors group ${className}`} onClick={() => { setDraft(value); setEditing(true) }}>
      {value}
      <Edit3 className="w-3.5 h-3.5 inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  )
}

function SongRow({ song, index, total, playlistId }: {
  song: Song; index: number; total: number; playlistId: string
}) {
  const playSong = usePlayerStore((s) => s.playSong)
  const { removeFromPlaylist, reorderPlaylistSongs, isFavorite, toggleFavorite } = useLibraryStore()

  const moveSong = (dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= total) return
    reorderPlaylistSongs(playlistId, index, to)
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group">
      <span className="w-6 text-center text-zinc-500 text-sm">{index + 1}</span>
      <img src={song.coverUrl} alt={song.title} className="w-10 h-10 rounded-lg object-cover" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{song.title}</p>
        <p className="text-zinc-500 text-xs truncate">{song.artist}</p>
      </div>
      <span className="text-zinc-500 text-sm w-32 truncate hidden md:block">{song.album}</span>
      <span className="text-zinc-500 text-sm flex items-center gap-1 w-16">
        <Clock className="w-3 h-3" />{formatDuration(song.duration)}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1.5 hover:text-amber transition-colors" onClick={() => playSong(song)}>
          <Play className="w-4 h-4" />
        </button>
        <button className={`p-1.5 transition-colors ${isFavorite(song.id) ? 'text-amber' : 'hover:text-amber'}`} onClick={() => toggleFavorite(song.id)}>
          <Heart className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-zinc-300 transition-colors disabled:opacity-20" onClick={() => moveSong(-1)} disabled={index === 0}>
          <ArrowUp className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-zinc-300 transition-colors disabled:opacity-20" onClick={() => moveSong(1)} disabled={index === total - 1}>
          <ArrowDown className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-coral transition-colors text-zinc-500" onClick={() => removeFromPlaylist(playlistId, song.id)}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function CoverModal({ open, currentUrl, onClose }: { open: boolean; currentUrl: string; onClose: () => void }) {
  const { id } = useParams<{ id: string }>()
  const updatePlaylist = useLibraryStore((s) => s.updatePlaylist)
  const [url, setUrl] = useState(currentUrl)

  if (!open || !id) return null

  const save = () => {
    updatePlaylist(id, { coverUrl: url.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="glass-card w-[480px] p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold text-white mb-6">编辑封面</h2>
        <input className="input-dark w-full" placeholder="输入新的封面图片链接" value={url} onChange={(e) => setUrl(e.target.value)} />
        {url && <div className="mt-3 aspect-video rounded-xl overflow-hidden"><img src={url} alt="预览" className="w-full h-full object-cover" /></div>}
        <div className="flex gap-3 mt-6 justify-end">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist)

  if (!open || !id) return null

  const confirm = () => {
    deletePlaylist(id)
    navigate('/playlists')
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="glass-card w-[400px] p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold text-white mb-3">删除歌单</h2>
        <p className="text-zinc-400 mb-6">确定要删除这个歌单吗？此操作无法撤销。</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="px-6 py-2.5 bg-coral text-white font-display font-semibold rounded-full hover:bg-coral/80 transition-all" onClick={confirm}>删除</button>
        </div>
      </div>
    </div>
  )
}

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const playlists = useLibraryStore((s) => s.playlists)
  const updatePlaylist = useLibraryStore((s) => s.updatePlaylist)
  const playSong = usePlayerStore((s) => s.playSong)

  const [showCoverModal, setShowCoverModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const playlist = playlists.find((p) => p.id === id)

  if (!playlist) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-zinc-500 text-lg">歌单不存在</p>
        <button className="btn-ghost mt-4" onClick={() => navigate('/playlists')}>返回歌单列表</button>
      </div>
    )
  }

  const playlistSongs = playlist.songs
    .map((sid) => allSongs.find((s) => s.id === sid))
    .filter((s): s is Song => !!s)

  return (
    <div className="p-6">
      <div className="flex gap-8 mb-10">
        <img src={playlist.coverUrl} alt={playlist.name} className="w-48 h-48 rounded-2xl object-cover flex-shrink-0" />
        <div className="flex flex-col justify-end min-w-0">
          <InlineEdit
            value={playlist.name}
            onSave={(v) => updatePlaylist(playlist.id, { name: v })}
            className="font-display text-3xl font-bold text-white"
          />
          <InlineEdit
            value={playlist.description}
            onSave={(v) => updatePlaylist(playlist.id, { description: v })}
            className="text-zinc-400 mt-2"
          />
          <p className="text-zinc-500 text-sm mt-3">
            {playlist.songs.length} 首歌曲 · 创建于 {formatDate(playlist.createdAt)}
          </p>
          <div className="flex gap-3 mt-5">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => playlistSongs.length && playSong(playlistSongs[0], playlistSongs)}
            >
              <Play className="w-4 h-4" /> 播放全部
            </button>
            <button className="btn-ghost flex items-center gap-2" onClick={() => setShowCoverModal(true)}>
              <Image className="w-4 h-4" /> 编辑封面
            </button>
            <button className="btn-ghost flex items-center gap-2 text-coral" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="w-4 h-4" /> 删除歌单
            </button>
          </div>
        </div>
      </div>

      {playlistSongs.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">歌单中还没有歌曲</div>
      ) : (
        <div className="space-y-1">
          {playlistSongs.map((song, i) => (
            <SongRow key={song.id} song={song} index={i} total={playlistSongs.length} playlistId={playlist.id} />
          ))}
        </div>
      )}

      <CoverModal open={showCoverModal} currentUrl={playlist.coverUrl} onClose={() => setShowCoverModal(false)} />
      <DeleteModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </div>
  )
}
