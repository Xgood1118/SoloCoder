import React, { useState } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { PhotoGrid } from './components/PhotoGrid'
import { MapView } from './components/MapView'
import { TagFilter } from './components/TagFilter'
import { DuplicateDetector } from './components/DuplicateDetector'
import { SyncConflictResolver } from './components/SyncConflictResolver'

const AppContent: React.FC = () => {
  const { viewMode } = useApp()
  const [showDuplicateDetector, setShowDuplicateDetector] = useState(false)
  const [showConflictResolver, setShowConflictResolver] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header
        onOpenDuplicateDetector={() => setShowDuplicateDetector(true)}
        onOpenConflictResolver={() => setShowConflictResolver(true)}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Toolbar />
          {viewMode === 'grid' ? <PhotoGrid /> : <MapView />}
          <TagFilter />
        </div>
      </div>

      {showDuplicateDetector && (
        <DuplicateDetector onClose={() => setShowDuplicateDetector(false)} />
      )}
      
      {showConflictResolver && (
        <SyncConflictResolver onClose={() => setShowConflictResolver(false)} />
      )}
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
