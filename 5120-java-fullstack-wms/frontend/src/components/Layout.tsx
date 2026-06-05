import { Layout, Menu, Avatar, Dropdown, Button } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  InboxOutlined,
  SendOutlined,
  DatabaseOutlined,
  BarcodeOutlined,
  DownloadOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { useEffect, useState } from 'react'

const { Header, Sider, Content } = Layout

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }
    const info = localStorage.getItem('userInfo')
    if (info) {
      setUserInfo(JSON.parse(info))
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    navigate('/login')
  }

  const menuItems = [
    { key: '/stock-in', icon: <InboxOutlined />, label: '入库管理' },
    { key: '/stock-out', icon: <SendOutlined />, label: '出库管理' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存查询' },
    { key: '/batch', icon: <BarcodeOutlined />, label: '批次管理' },
    { key: '/export', icon: <DownloadOutlined />, label: '数据导出' }
  ]

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark">
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          WMS系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} size="small" />
              <span>{userInfo?.realName || userInfo?.username}</span>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
