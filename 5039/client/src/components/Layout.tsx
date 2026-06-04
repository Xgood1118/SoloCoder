import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { path: '/', label: '仪表盘', icon: '📊' },
  { path: '/articles', label: '文章管理', icon: '📝' },
  { path: '/categories', label: '分类管理', icon: '📁' },
  { path: '/tags', label: '标签管理', icon: '🏷️' },
  { path: '/templates', label: '模板管理', icon: '🎨' },
  { path: '/approvals', label: '审批中心', icon: '✅' },
  { path: '/trash', label: '回收站', icon: '🗑️' },
  { path: '/logs', label: '操作日志', icon: '📋' },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">CMS 管理系统</h1>
        </div>
        <nav className="p-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 mb-1 rounded-lg transition-colors ${
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
