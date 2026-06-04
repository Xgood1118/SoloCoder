import React, { useState } from 'react'
import { Copy, Check, Trash2, X, AlertCircle } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatFileSize, formatDate } from '../utils/format'

export const DuplicateDetector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { duplicateGroups, deletePhotos } = useApp()
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteSelected = () => {
    if (confirm(`确定要删除选中的 ${selectedPhotos.size} 张重复照片吗？`)) {
      deletePhotos(Array.from(selectedPhotos))
      setSelectedPhotos(new Set())
    }
  }

  if (duplicateGroups.size === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">没有发现重复照片</h3>
          <p className="text-gray-500 mb-6">您的照片库很整洁，没有发现重复的照片。</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Copy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg">重复照片检测</h3>
              <p className="text-sm text-gray-500">
                发现 {duplicateGroups.size} 组重复照片，共 {Array.from(duplicateGroups.values()).reduce((acc, g) => acc + g.length, 0)} 张
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Array.from(duplicateGroups.entries()).map(([groupId, photos]) => (
            <div key={groupId} className="border rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  重复组 {groupId} - {photos.length} 张内容相似的照片
                </span>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                {photos.map(photo => (
                  <div
                    key={photo.id}
                    className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      selectedPhotos.has(photo.id)
                        ? 'border-red-500'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    onClick={() => toggleSelect(photo.id)}
                  >
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center">
                      {selectedPhotos.has(photo.id) && (
                        <Check className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs font-medium truncate">{photo.name}</p>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{formatFileSize(photo.size)}</span>
                        <span>{formatDate(photo.takenAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <span className="text-sm text-gray-600">
            已选择 {selectedPhotos.size} 张待删除
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              取消
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedPhotos.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              删除选中 ({selectedPhotos.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
