import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Dropdown, Avatar, Button, Modal, message } from 'antd'
import {
  TeamOutlined,
  ApartmentOutlined,
  SafetyOutlined,
  FileTextOutlined,
  LogoutOutlined,
  UserOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import { useUserStore } from '../stores/userStore'
import { storage } from '../utils/storage'

const { Header, Sider, Content, Footer } = Layout

const UserList = lazy(() => import('../components/UserList'))
const OrganizationTree = lazy(() => import('../components/OrganizationTree'))
const RoleManagement = lazy(() => import('../components/RoleManagement'))
const OperationLogs = lazy(() => import('../components/OperationLogs'))

const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, loadData, hasPermission } = useUserStore()

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      onOk: () => {
        storage.setCurrentUser(null)
        navigate('/login')
      },
    })
  }

  const handleExportConfig = () => {
    const config = storage.exportConfig()
    const blob = new Blob([config], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `配置导出_${new Date().toLocaleDateString()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success('配置导出成功')
  }

  const handleImportConfig = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (storage.importConfig(content)) {
          message.success('配置导入成功，正在刷新...')
          loadData()
        } else {
          message.error('配置导入失败')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const menuItems = [
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: '用户管理',
    },
    {
      key: '/organization',
      icon: <ApartmentOutlined />,
      label: '组织架构',
    },
    {
      key: '/roles',
      icon: <SafetyOutlined />,
      label: '角色权限',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '操作日志',
    },
  ]

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: currentUser?.name || '用户',
        disabled: true,
      },
      {
        key: 'export',
        icon: <ExportOutlined />,
        label: '导出配置',
        onClick: handleExportConfig,
      },
      {
        key: 'import',
        icon: <ImportOutlined />,
        label: '导入配置',
        onClick: handleImportConfig,
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  }

  return (
    <Layout className="app-layout">
      <Sider width={200} theme="dark" collapsible>
        <div className="app-logo" style={{ padding: 16, color: '#fff', textAlign: 'center' }}>
          用户管理系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div style={{ fontWeight: 500 }}>企业后台管理系统</div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Button type="text" style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
              {currentUser?.name || '管理员'}
            </Button>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Suspense fallback={<div style={{ textAlign: 'center', padding: 50 }}>加载中...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/users" replace />} />
              <Route
                path="/users"
                element={
                  hasPermission('user', 'canView') ? (
                    <UserList onEdit={() => {}} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                      您没有访问该页面的权限
                    </div>
                  )
                }
              />
              <Route
                path="/organization"
                element={
                  hasPermission('department', 'canView') ? (
                    <OrganizationTree />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                      您没有访问该页面的权限
                    </div>
                  )
                }
              />
              <Route
                path="/roles"
                element={
                  hasPermission('role', 'canView') ? (
                    <RoleManagement />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                      您没有访问该页面的权限
                    </div>
                  )
                }
              />
              <Route
                path="/logs"
                element={
                  hasPermission('log', 'canView') ? (
                    <OperationLogs />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                      您没有访问该页面的权限
                    </div>
                  )
                }
              />
              <Route path="*" element={<Navigate to="/users" replace />} />
            </Routes>
          </Suspense>
        </Content>
        <Footer className="app-footer">
          用户管理系统 ©{new Date().getFullYear()} Created with React + Vite
        </Footer>
      </Layout>
    </Layout>
  )
}

export default AppLayout
