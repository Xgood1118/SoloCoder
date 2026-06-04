import React from 'react'
import { Tag, X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn } from '../utils/cn'

export const TagFilter: React.FC = () => {
  const { allTags, filterTags, toggleFilterTag, photos } = useApp()

  const getTagCount = (tag: string) => {
    return photos.filter(p => p.tags.includes(tag)).length
  }

  return (
    <div className="border-t bg-white px-4 py-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-600">标签筛选:</span>
        
        <div className="flex-1 flex flex-wrap gap-2">
          {filterTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleFilterTag(tag)}
              className="flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
            >
              {tag}
              <X className="w-3 h-3" />
            </button>
          ))}
          
          {filterTags.length > 0 && (
            <div className="h-6 w-px bg-gray-200 mx-1" />
          )}
          
          {allTags
            .filter(t => !filterTags.includes(t))
            .slice(0, 10)
            .map(tag => (
              <button
                key={tag}
                onClick={() => toggleFilterTag(tag)}
                className={cn(
                  'px-2 py-1 rounded-full text-sm transition-colors',
                  filterTags.includes(tag)
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {tag}
                <span className="ml-1 text-xs opacity-60">({getTagCount(tag)})</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
