import { NavLink } from 'react-router-dom'
import { Disc, Home, PlayCircle, Library, ListMusic, Search, Settings } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: '发现音乐' },
  { to: '/now-playing', icon: PlayCircle, label: '正在播放' },
  { to: '/library', icon: Library, label: '音乐库' },
  { to: '/playlists', icon: ListMusic, label: '歌单' },
  { to: '/search', icon: Search, label: '搜索' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-charcoal border-r border-white/5 flex flex-col z-30">
      <div className="px-5 py-6 flex items-center gap-3">
        <Disc className="w-7 h-7 text-amber" />
        <span className="font-display text-xl font-bold text-gradient-amber">Melodia</span>
      </div>

      <nav className="flex-1 px-3 mt-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body transition-all duration-200 border-l-2 ${
                isActive
                  ? 'text-amber bg-amber/10 border-l-amber'
                  : 'text-zinc-400 border-l-transparent hover:text-zinc-200 hover:bg-white/5'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-zinc-600 font-body">
        v1.0 · 企业版
      </div>
    </aside>
  )
}
