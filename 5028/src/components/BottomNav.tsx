import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Compass, PlusCircle, Heart, User } from 'lucide-react'

const tabs = [
  { path: '/', label: '首页', Icon: Home },
  { path: '/explore', label: '探索', Icon: Compass },
  { path: '/trip/new', label: '新建行程', Icon: PlusCircle },
  { path: '/favorites', label: '收藏', Icon: Heart },
  { path: '/profile', label: '我的', Icon: User },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-sand-200 z-50">
      <div className="flex">
        {tabs.map(({ path, label, Icon }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-1 flex-col items-center justify-center py-2 gap-0.5"
            >
              <Icon
                size={22}
                className={active ? 'text-coral-500' : 'text-gray-400'}
                fill={active ? 'currentColor' : 'none'}
                strokeWidth={active ? 2 : 1.5}
              />
              <span
                className={`text-xs ${
                  active ? 'text-coral-500 font-medium' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
