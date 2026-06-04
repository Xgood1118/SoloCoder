import React from 'react'
import {
  Search,
  Upload,
  Map,
  LayoutGrid,
  Copy,
  AlertTriangle,
  Bell,
  Settings,
  User,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn } from '../utils/cn'

export const Header: React.FC<{
  onOpenDuplicateDetector: () => void
  onOpenConflictResolver: () => void
}> = ({ onOpenDuplicateDetector, onOpenConflictResolver }) => {
  const {
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    duplicateGroups,
    syncConflicts,
  } = useApp()

  const duplicateCount = Array.from(duplicateGroups.values()).reduce((acc, group) => acc + group.length, 0)
  const conflictCount = syncConflicts.filter(c => !c.resolved).length

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800">照片管理</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索照片..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-80 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'grid' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'
            )}
            title="网格视图"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'map' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'
            )}
            title="地图视图"
          >
            <Map className="w-4 h-4" />
          </button>
        </div>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <button
          onClick={onOpenDuplicateDetector}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="重复照片检测"
        >
          <Copy className="w-5 h-5" />
          {duplicateCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
              {duplicateCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenConflictResolver}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="同步冲突"
        >
          <AlertTriangle className="w-5 h-5" />
          {conflictCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {conflictCount}
            </span>
          )}
        </button>

        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
          <Upload className="w-4 h-4" />
          上传照片
        </button>

        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-2">
          <User className="w-5 h-5 text-gray-500" />
        </div>
      </div>
    </header>
  )
}
