import React, { useState } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  Tag,
  Trash2,
  X,
  Check,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn } from '../utils/cn'
import type { SortField } from '../types'

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'takenAt', label: '拍照时间' },
  { value: 'name', label: '文件名称' },
  { value: 'size', label: '文件大小' },
  { value: 'createdAt', label: '上传时间' },
]

export const Toolbar: React.FC = () => {
  const {
    selectedPhotoIds,
    clearSelection,
    sortField,
    sortOrder,
    setSortField,
    setSortOrder,
    filteredPhotos,
    selectAllPhotos,
    movePhotosToAlbum,
    addTagsToPhotos,
    deletePhotos,
    albums,
    allTags,
  } = useApp()

  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [selectedAlbumId, setSelectedAlbumId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const selectedCount = selectedPhotoIds.size
  const totalCount = filteredPhotos.length

  const handleSelectAll = () => {
    if (selectedCount === totalCount && totalCount > 0) {
      clearSelection()
    } else {
      selectAllPhotos(filteredPhotos.map(p => p.id))
    }
  }

  const handleMove = () => {
    if (selectedAlbumId) {
      movePhotosToAlbum(Array.from(selectedPhotoIds), selectedAlbumId)
      setShowMoveModal(false)
      setSelectedAlbumId('')
    }
  }

  const handleAddTags = () => {
    if (selectedTags.length > 0) {
      addTagsToPhotos(Array.from(selectedPhotoIds), selectedTags)
      setShowTagModal(false)
      setSelectedTags([])
    }
  }

  const handleDelete = () => {
    if (confirm(`确定要删除选中的 ${selectedCount} 张照片吗？`)) {
      deletePhotos(Array.from(selectedPhotoIds))
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="h-12 bg-white border-b flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedCount === totalCount && totalCount > 0}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">
            {selectedCount > 0
              ? `已选择 ${selectedCount} 张`
              : `共 ${totalCount} 张照片`}
          </span>
        </div>

        {selectedCount > 0 && (
          <button
            onClick={clearSelection}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {selectedCount > 0 ? (
          <>
            <button
              onClick={() => setShowMoveModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              移动到相册
            </button>
            <button
              onClick={() => setShowTagModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Tag className="w-4 h-4" />
              添加标签
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2" />
          </>
        ) : null}

        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOptions.find(o => o.value === sortField)?.label}
            {sortOrder === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )}
          </button>

          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 z-20 min-w-40">
              {sortOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    if (sortField === option.value) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortField(option.value)
                      setSortOrder('desc')
                    }
                    setShowSortMenu(false)
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between',
                    sortField === option.value ? 'text-primary-600' : ''
                  )}
                >
                  <span>{option.label}</span>
                  {sortField === option.value && (
                    sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMoveModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">移动到相册</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {albums.map(album => (
                <label
                  key={album.id}
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                    selectedAlbumId === album.id ? 'border-primary-500 bg-primary-50' : 'hover:bg-gray-50'
                  )}
                >
                  <input
                    type="radio"
                    name="album"
                    checked={selectedAlbumId === album.id}
                    onChange={() => setSelectedAlbumId(album.id)}
                    className="sr-only"
                  />
                  <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=100&q=60"
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{album.name}</div>
                    <div className="text-sm text-gray-500">{album.photoCount} 张照片</div>
                  </div>
                  {selectedAlbumId === album.id && <Check className="w-5 h-5 text-primary-500" />}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowMoveModal(false); setSelectedAlbumId('') }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleMove}
                disabled={!selectedAlbumId}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认移动
              </button>
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">添加标签</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm transition-colors',
                    selectedTags.includes(tag)
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowTagModal(false); setSelectedTags([]) }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddTags}
                disabled={selectedTags.length === 0}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加 {selectedTags.length} 个标签
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
