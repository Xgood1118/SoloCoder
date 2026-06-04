import React, { useState } from 'react'
import {
  Image,
  Lock,
  Users,
  Globe,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn } from '../utils/cn'
import type { Album } from '../types'

export const Sidebar: React.FC = () => {
  const { albums, currentAlbumId, setCurrentAlbum, deleteAlbum, syncConflicts } = useApp()
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    all: true,
    my: true,
    team: true,
    public: true,
  })
  const [albumMenu, setAlbumMenu] = useState<string | null>(null)

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const getVisibilityIcon = (visibility: Album['visibility']) => {
    switch (visibility) {
      case 'private': return <Lock className="w-3 h-3" />
      case 'team': return <Users className="w-3 h-3" />
      case 'public': return <Globe className="w-3 h-3" />
    }
  }

  const unresolvedConflicts = syncConflicts.filter(c => !c.resolved).length

  const AlbumItem: React.FC<{ album: Album }> = ({ album }) => (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        currentAlbumId === album.id
          ? 'bg-primary-100 text-primary-700'
          : 'hover:bg-gray-100'
      )}
      onClick={() => setCurrentAlbum(album.id)}
    >
      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-200">
        {album.coverPhotoId ? (
          <img
            src={`https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=100&q=60`}
            alt={album.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Image className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium truncate">{album.name}</span>
          {getVisibilityIcon(album.visibility)}
        </div>
        <div className="text-xs text-gray-500">{album.photoCount} 张照片</div>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
        onClick={(e) => {
          e.stopPropagation()
          setAlbumMenu(albumMenu === album.id ? null : album.id)
        }}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {albumMenu === album.id && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 z-10 min-w-32">
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation()
              setAlbumMenu(null)
            }}
          >
            <Edit2 className="w-4 h-4" />
            编辑相册
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation()
              deleteAlbum(album.id)
              setAlbumMenu(null)
            }}
          >
            <Trash2 className="w-4 h-4" />
            删除相册
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="w-64 bg-white border-r flex flex-col h-full">
      <div className="p-4 border-b">
        <button
          onClick={() => setShowNewAlbumModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          新建相册
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        <div>
          <button
            onClick={() => setCurrentAlbum(null)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              !currentAlbumId ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
            )}
          >
            <Image className="w-5 h-5" />
            <span className="font-medium">全部照片</span>
          </button>
        </div>

        <div>
          <button
            onClick={() => toggleSection('my')}
            className="w-full flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {expandedSections.my ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Lock className="w-4 h-4" />
            我的相册
          </button>
          {expandedSections.my && (
            <div className="mt-1 space-y-1">
              {albums.filter(a => a.visibility === 'private').map(album => (
                <AlbumItem key={album.id} album={album} />
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => toggleSection('team')}
            className="w-full flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {expandedSections.team ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Users className="w-4 h-4" />
            团队相册
          </button>
          {expandedSections.team && (
            <div className="mt-1 space-y-1">
              {albums.filter(a => a.visibility === 'team').map(album => (
                <AlbumItem key={album.id} album={album} />
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => toggleSection('public')}
            className="w-full flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {expandedSections.public ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Globe className="w-4 h-4" />
            公开相册
          </button>
          {expandedSections.public && (
            <div className="mt-1 space-y-1">
              {albums.filter(a => a.visibility === 'public').map(album => (
                <AlbumItem key={album.id} album={album} />
              ))}
            </div>
          )}
        </div>
      </div>

      {unresolvedConflicts > 0 && (
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
            <div className="flex-1">
              <div className="text-sm font-medium">同步冲突</div>
              <div className="text-xs">{unresolvedConflicts} 个待处理</div>
            </div>
          </div>
        </div>
      )}

      {showNewAlbumModal && (
        <NewAlbumModal onClose={() => setShowNewAlbumModal(false)} />
      )}
    </div>
  )
}

const NewAlbumModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { createAlbum } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Album['visibility']>('private')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createAlbum({
      name,
      description,
      visibility,
      createdAt: new Date(),
      updatedAt: new Date(),
      photoCount: 0,
      sortBy: 'takenAt',
      sortOrder: 'desc',
      createdBy: 'user1',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">新建相册</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">相册名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="输入相册名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">描述（可选）</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              placeholder="输入相册描述"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">可见性</label>
            <div className="space-y-2">
              {[
                { value: 'private', label: '仅自己', icon: Lock, desc: '只有您可以查看' },
                { value: 'team', label: '团队', icon: Users, desc: '指定团队成员可查看' },
                { value: 'public', label: '公开', icon: Globe, desc: '所有人可见' },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                    visibility === opt.value ? 'border-primary-500 bg-primary-50' : 'hover:bg-gray-50'
                  )}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value as Album['visibility'])}
                    className="sr-only"
                  />
                  <opt.icon className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-sm text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
