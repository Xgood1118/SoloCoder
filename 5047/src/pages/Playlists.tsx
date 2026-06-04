import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListMusic, Plus, Play, Edit3 } from 'lucide-react'
import { useLibraryStore } from '@/stores/libraryStore'
import type { Playlist } from '@/types'

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const navigate = useNavigate()

  return (
    <div
      className="glass-card-hover cursor-pointer group relative p-3"
      onClick={() => navigate(`/playlists/${playlist.id}`)}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden">
        <img
          src={playlist.coverUrl}
          alt={playlist.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
          <button
            className="w-12 h-12 rounded-full bg-amber flex items-center justify-center hover:bg-amber-light transition-colors"
            onClick={(e) => { e.stopPropagation() }}
          >
            <Play className="w-5 h-5 text-midnight ml-0.5" />
          </button>
          <button
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation() }}
          >
            <Edit3 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      <h3 className="font-display font-semibold text-white mt-3">{playlist.name}</h3>
      <p className="text-zinc-500 text-sm">{playlist.songs.length} 首歌曲</p>
      {playlist.description && (
        <p className="line-clamp-2 text-zinc-400 text-sm mt-1">{playlist.description}</p>
      )}
    </div>
  )
}

function CreatePlaylistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const createPlaylist = useLibraryStore((s) => s.createPlaylist)

  if (!open) return null

  const handleSubmit = () => {
    if (!name.trim()) return
    createPlaylist(name.trim(), description.trim(), coverUrl.trim())
    setName('')
    setDescription('')
    setCoverUrl('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="glass-card w-[480px] p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold text-white mb-6">新建歌单</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">歌单名称</label>
            <input
              className="input-dark w-full"
              placeholder="输入歌单名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">描述</label>
            <textarea
              className="input-dark w-full resize-none h-24"
              placeholder="输入歌单描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">封面 URL</label>
            <input
              className="input-dark w-full"
              placeholder="输入封面图片链接（可选）"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
            />
            {coverUrl && (
              <div className="mt-2 aspect-video rounded-xl overflow-hidden">
                <img src={coverUrl} alt="预览" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-8 justify-end">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit}>创建</button>
        </div>
      </div>
    </div>
  )
}

export default function Playlists() {
  const [showCreate, setShowCreate] = useState(false)
  const playlists = useLibraryStore((s) => s.playlists)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-bold text-gradient-amber flex items-center gap-3">
          <ListMusic className="w-8 h-8" />
          我的歌单
        </h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          新建歌单
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <ListMusic className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">还没有歌单</p>
          <p className="text-sm mt-1">点击「新建歌单」创建你的第一个歌单</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      )}

      <CreatePlaylistModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
