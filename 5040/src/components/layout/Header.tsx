import { Search, Bell, User, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: '合同即将到期', message: 'HT202403001 合同将在15天后到期', time: '10分钟前', type: 'warning' },
    { id: 2, title: '租金逾期', message: '租客王五的6月租金已逾期3天', time: '1小时前', type: 'error' },
    { id: 3, title: '新房源入库', message: 'FY2024006 房源已成功录入', time: '2小时前', type: 'success' },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索房源、租客、合同..."
            className="pl-10 pr-4 py-2 w-64 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50">
              <div className="p-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">通知中心</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        item.type === 'error' ? 'bg-red-500' :
                        item.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{item.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{item.message}</p>
                        <p className="text-slate-400 text-xs mt-1">{item.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-slate-100">
                <button className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  查看全部通知
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              管
            </div>
            <span className="hidden md:block text-sm font-medium text-slate-700">管理员</span>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50">
              <div className="p-2">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  <User className="w-4 h-4" />
                  个人设置
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
