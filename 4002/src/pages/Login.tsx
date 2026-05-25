import React, { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { storage } from '../utils/storage'
import { getCurrentTime } from '../utils/helpers'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { users, addLog } = useUserStore()
  const [loading, setLoading] = useState(false)

  const handleLogin = (values: { username: string; password: string }) => {
    setLoading(true)

    setTimeout(() => {
      const user = users.find(
        (u) =>
        (u.name === values.username || u.employeeId === values.username || u.phone === values.username) &&
        u.password === values.password &&
        u.status === 'active'
      )

      if (user) {
        const userRoleIds = user.roles || []
        const isSuperAdmin = userRoleIds.includes('role_1') || userRoleIds.includes('role_2')

        const currentUser = {
          id: user.id,
          name: user.name,
          roles: userRoleIds,
          departmentId: user.departmentId,
          isSuperAdmin,
        }

        storage.setCurrentUser(currentUser)

        const updatedUsers = users.map((u) =>
          u.id === user.id ? { ...u, lastLoginTime: getCurrentTime() } : u
        )
        storage.setUsers(updatedUsers)

        addLog({
          userId: user.id,
          userName: user.name,
          action: '登录',
          targetType: 'user',
          targetId: user.id,
          targetName: user.name,
          detail: '用户登录系统',
          ip: '127.0.0.1',
        })

        message.success('登录成功')
        navigate('/')
      } else {
        message.error('用户名或密码错误，或账号已被停用')
      }

      setLoading(false)
    }, 500)
  }

  return (
    <div
      style={{
        display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}
    >
      <Card
      style={{
        width: 400,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#1890ff' }}>用户管理系统</h1>
        <p style={{ color: '#999', marginTop: 8 }}>企业后台管理系统</p>
      </div>

      <Form
        name="login"
        onFinish={handleLogin}
        initialValues={{ username: '张伟', password: 'Admin@123' }}
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入用户名/工号/手机号' }]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="用户名/工号/手机号"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="密码"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
          >
            登录
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
        <p>测试账号：张伟 / Admin@123</p>
        <p>工号：2020001</p>
      </div>
    </Card>
    </div>
  )
}

export default Login
