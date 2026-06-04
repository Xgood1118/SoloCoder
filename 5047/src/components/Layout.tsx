import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import PlayerBar from './PlayerBar'

export default function Layout() {
  return (
    <div className="flex h-screen bg-midnight text-white">
      <Sidebar />
      <main className="ml-60 flex-1 overflow-y-auto h-screen pb-20">
        <Outlet />
      </main>
      <PlayerBar />
    </div>
  )
}
