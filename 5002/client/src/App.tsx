import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import Schedules from './pages/Schedules'
import Enrollment from './pages/Enrollment'
import Grades from './pages/Grades'
import Attendance from './pages/Attendance'
import Resources from './pages/Resources'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import { Role } from './types'

function App() {
  const { token, user } = useAuthStore()

  const isAuthenticated = !!token

  const getHomeRoute = () => {
    if (!user) return '/login'
    switch (user.role) {
      case Role.ADMIN:
      case Role.ACADEMIC_SECRETARY:
        return '/dashboard'
      case Role.TEACHER:
        return '/courses'
      case Role.STUDENT:
        return '/enrollment'
      case Role.COUNSELOR:
        return '/attendance'
      default:
        return '/dashboard'
    }
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/schedules" element={<Schedules />} />
        <Route path="/enrollment" element={<Enrollment />} />
        <Route path="/grades" element={<Grades />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
    </Layout>
  )
}

export default App
