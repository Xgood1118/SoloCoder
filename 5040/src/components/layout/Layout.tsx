import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles: Record<string, string> = {
  '/': '仪表盘',
  '/properties': '房源管理',
  '/properties/new': '新增房源',
  '/tenants': '租客管理',
  '/tenants/new': '新增租客',
  '/contracts': '租约管理',
  '/contracts/new': '新建合同',
  '/finance': '费用管理',
  '/handover': '交接管理',
};

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/properties/') && path !== '/properties/new') {
      return '房源详情';
    }
    if (path.startsWith('/tenants/') && path !== '/tenants/new') {
      return '租客详情';
    }
    if (path.startsWith('/contracts/') && path !== '/contracts/new') {
      return '合同详情';
    }
    return pageTitles[path] || '房产管理系统';
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={getPageTitle()} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
