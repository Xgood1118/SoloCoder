import { NavLink } from 'react-router-dom';
import {
  Home,
  Building2,
  Users,
  FileText,
  DollarSign,
  ClipboardList,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: '/', icon: Home, label: '仪表盘' },
  { path: '/properties', icon: Building2, label: '房源管理' },
  { path: '/tenants', icon: Users, label: '租客管理' },
  { path: '/contracts', icon: FileText, label: '租约管理' },
  { path: '/finance', icon: DollarSign, label: '费用管理' },
  { path: '/handover', icon: ClipboardList, label: '交接管理' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Building2 className="w-8 h-8 text-blue-400" />
            <span className="text-lg font-bold">房产管理系统</span>
          </div>
        )}
        {collapsed && <Building2 className="w-8 h-8 text-blue-400 mx-auto" />}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors hidden md:block"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        {!collapsed && (
          <div className="text-xs text-slate-400 text-center">
            房产中介管理平台 v1.0
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden md:block transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        } flex-shrink-0`}
      >
        {sidebarContent()}
      </aside>

      <button
        className="md:hidden fixed bottom-4 right-4 z-50 p-3 bg-blue-600 text-white rounded-full shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 z-50">
            {sidebarContent()}
          </aside>
        </div>
      )}
    </>
  );
}
