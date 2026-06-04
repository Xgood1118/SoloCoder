import React, { useState } from 'react'
import {
  Check,
  Copy,
  AlertCircle,
  Clock,
  MapPin,
  Tag,
  X,
  Info,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn } from '../utils/cn'
import { formatFileSize, formatDate } from '../utils/format'
import type { Photo } from '../types'

export const PhotoGrid: React.FC = () => {
  const { filteredPhotos, selectedPhotoIds, selectPhoto } = useApp()
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)

  const getSyncStatusColor = (status: Photo['syncStatus']) => {
    switch (status) {
      case 'synced': return 'bg-green-500'
      case 'syncing': return 'bg-blue-500'
      case 'conflict': return 'bg-red-500'
      case 'pending': return 'bg-gray-400'
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {filteredPhotos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Info className="w-10 h-10" />
            </div>
            <p className="text-lg">没有找到照片</p>
            <p className="text-sm">尝试调整筛选条件或上传新照片</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredPhotos.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                isSelected={selectedPhotoIds.has(photo.id)}
                onSelect={() => selectPhoto(photo.id, true)}
                onPreview={() => setPreviewPhoto(photo)}
                syncStatusColor={getSyncStatusColor(photo.syncStatus)}
              />
            ))}
          </div>
        )}
      </div>

      {previewPhoto && (
        <PhotoPreview photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
      )}
    </>
  )
}

const PhotoCard: React.FC<{
  photo: Photo
  isSelected: boolean
  onSelect: () => void
  onPreview: () => void
  syncStatusColor: string
}> = ({ photo, isSelected, onSelect, onPreview, syncStatusColor }) => {
  return (
    <div
      className={cn(
        'group relative aspect-square rounded-lg overflow-hidden bg-gray-200 cursor-pointer transition-all duration-200',
        isSelected ? 'ring-2 ring-primary-500 ring-offset-2' : 'hover:shadow-lg'
      )}
      onClick={onPreview}
    >
      <img
        src={photo.thumbnailUrl}
        alt={photo.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      <div
        className={cn(
          'absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
          isSelected
            ? 'bg-primary-500 border-primary-500'
            : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>

      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${syncStatusColor}`} />

      {photo.isDuplicate && (
        <div className="absolute top-8 right-2 p-1 bg-amber-500 text-white rounded">
          <Copy className="w-3 h-3" />
        </div>
      )}

      {photo.syncStatus === 'conflict' && (
        <div className="absolute top-8 right-2 p-1 bg-red-500 text-white rounded">
          <AlertCircle className="w-3 h-3" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-xs truncate">{photo.name}</p>
        <div className="flex items-center gap-2 mt-1 text-white/80 text-xs">
          <span>{formatDate(photo.takenAt)}</span>
          <span>{formatFileSize(photo.size)}</span>
        </div>
      </div>
    </div>
  )
}

const PhotoPreview: React.FC<{ photo: Photo; onClose: () => void }> = ({ photo, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="flex h-full w-full max-w-7xl px-8" onClick={e => e.stopPropagation()}>
        <div className="flex-1 flex items-center justify-center">
          <img
            src={photo.url}
            alt={photo.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>

        <div className="w-80 bg-white ml-4 my-4 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-bold text-lg truncate">{photo.name}</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">基本信息</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">文件大小</span>
                  <span>{formatFileSize(photo.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">拍照时间</span>
                  <span>{formatDate(photo.takenAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">上传时间</span>
                  <span>{formatDate(photo.createdAt)}</span>
                </div>
              </div>
            </div>

            {photo.location && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  拍摄位置
                </h4>
                <p className="text-sm">{photo.location.address}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {photo.location.lat.toFixed(6)}, {photo.location.lng.toFixed(6)}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Tag className="w-4 h-4" />
                标签
              </h4>
              <div className="flex flex-wrap gap-1">
                {photo.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                同步状态
              </h4>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  photo.syncStatus === 'synced' && 'bg-green-500',
                  photo.syncStatus === 'syncing' && 'bg-blue-500',
                  photo.syncStatus === 'conflict' && 'bg-red-500',
                  photo.syncStatus === 'pending' && 'bg-gray-400',
                )} />
                <span className="text-sm">
                  {photo.syncStatus === 'synced' && '已同步'}
                  {photo.syncStatus === 'syncing' && '同步中'}
                  {photo.syncStatus === 'conflict' && '存在冲突'}
                  {photo.syncStatus === 'pending' && '等待同步'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
