import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import TaskList from '@/pages/TaskList'
import TaskCreate from '@/pages/TaskCreate'
import TaskDetail from '@/pages/TaskDetail'
import TaskEdit from '@/pages/TaskEdit'
import ExecutionList from '@/pages/ExecutionList'
import ExecutionDetail from '@/pages/ExecutionDetail'
import AlertList from '@/pages/AlertList'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/tasks/create" element={<TaskCreate />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/tasks/:id/edit" element={<TaskEdit />} />
          <Route path="/records" element={<ExecutionList />} />
          <Route path="/records/:id" element={<ExecutionDetail />} />
          <Route path="/alerts" element={<AlertList />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  )
}
