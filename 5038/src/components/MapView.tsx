import React, { useState } from 'react'
import { MapPin, X, Image } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatDate } from '../utils/format'
import type { Photo } from '../types'

export const MapView: React.FC = () => {
  const { photos } = useApp()
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  const photosWithLocation = photos.filter(p => p.location)

  const getMapPosition = (lat: number, lng: number) => {
    const minLat = 39.8, maxLat = 40.0
    const minLng = 116.2, maxLng = 116.4
    const x = ((lng - minLng) / (maxLng - minLng)) * 100
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) }
  }

  return (
    <div className="flex-1 bg-gray-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
          
          <path d="M 20 20 Q 40 10 60 25 T 90 60" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
          <path d="M 10 50 Q 30 40 50 55 T 85 40" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
          
          <rect x="15" y="20" width="25" height="20" fill="#e2e8f0" rx="2" />
          <rect x="45" y="15" width="30" height="25" fill="#cbd5e1" rx="2" />
          <rect x="60" y="55" width="25" height="20" fill="#e2e8f0" rx="2" />
          <rect x="20" y="60" width="20" height="15" fill="#cbd5e1" rx="2" />
        </svg>
      </div>

      {photosWithLocation.map(photo => {
        const pos = getMapPosition(photo.location!.lat, photo.location!.lng)
        return (
          <button
            key={photo.id}
            className="absolute transform -translate-x-1/2 -translate-y-full group"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => setSelectedPhoto(photo)}
          >
            <MapPin className="w-6 h-6 text-red-500 drop-shadow-lg" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-16 h-16 rounded overflow-hidden shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <img
                src={photo.thumbnailUrl}
                alt={photo.name}
                className="w-full h-full object-cover"
              />
            </div>
          </button>
        )
      })}

      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg">
        <div className="text-sm font-medium mb-2">位置分布</div>
        <div className="text-xs text-gray-500">
          <div>北京市朝阳区</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">
            {photosWithLocation.length} 张带位置的照片
          </div>
        </div>
      </div>

      {selectedPhoto && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10" onClick={() => setSelectedPhoto(null)}>
          <div className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-full h-64 object-cover"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-lg mb-2">{selectedPhoto.name}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {selectedPhoto.location?.address}
                </div>
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  {formatDate(selectedPhoto.takenAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
