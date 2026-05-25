import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useUserStore } from './stores/userStore'
import { useDepartmentStore } from './stores/departmentStore'
import { useRoleStore } from './stores/roleStore'
import { initMockData } from './utils/mockData'
import { storage } from './utils/storage'
import AppLayout from './layouts/AppLayout'
import Login from './pages/Login'

const App: React.FC = () => {
  const { currentUser, loadData } = useUserStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initMockData()
    loadData()
    useDepartmentStore.getState().loadData()
    useRoleStore.getState().loadData()
    setLoading(false)
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}>系统初始化中...</div>
  }

  const isLoggedIn = !!currentUser

  return (
    <Routes>
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/*"
        element={isLoggedIn ? <AppLayout /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
