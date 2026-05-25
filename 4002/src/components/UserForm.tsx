import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, DatePicker, message, Space, Button } from 'antd'
import { User } from '../types'
import { useUserStore } from '../stores/userStore'
import { useDepartmentStore } from '../stores/departmentStore'
import { generatePassword } from '../utils/helpers'
import dayjs from 'dayjs'

interface Props {
  visible: boolean
  user: User | null
  onClose: () => void
  onSuccess: () => void
}

const UserForm: React.FC<Props> = ({ visible, user, onClose, onSuccess }) => {
  const [form] = Form.useForm()
  const { addUser, updateUser, roles } = useUserStore()
  const { getDepartmentTree } = useDepartmentStore()
  const [generatedPassword, setGeneratedPassword] = useState('')

  useEffect(() => {
    if (visible) {
      if (user) {
        form.setFieldsValue({
          ...user,
          hireDate: user.hireDate ? dayjs(user.hireDate) : null,
        })
        setGeneratedPassword('')
      } else {
        form.resetFields()
        const pwd = generatePassword()
        setGeneratedPassword(pwd)
        form.setFieldsValue({
          password: pwd,
          hireDate: dayjs(),
          status: 'active',
        })
      }
    }
  }, [visible, user, form])

  const getDepartmentOptions = () => {
    const tree = getDepartmentTree()
    const options: { label: string; value: string }[] = []

    const traverse = (items: any[], prefix = '') => {
      items.forEach((item) => {
        options.push({
          label: prefix + item.name,
          value: item.id,
        })
        if (item.children && item.children.length > 0) {
          traverse(item.children, prefix + item.name + ' / ')
        }
      })
    }

    traverse(tree)
    return options
  }

  const handleGeneratePassword = () => {
    const pwd = generatePassword()
    setGeneratedPassword(pwd)
    form.setFieldsValue({ password: pwd })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const departmentOptions = getDepartmentOptions()
      const selectedDept = departmentOptions.find((d) => d.value === values.departmentId)

      const userData = {
        ...values,
        hireDate: values.hireDate?.format('YYYY-MM-DD'),
        departmentName: selectedDept?.label.split(' / ').pop() || '',
      }

      if (user) {
        const result = updateUser(user.id, userData)
        if (result.success) {
          message.success(result.message)
          onSuccess()
        } else {
          message.error(result.message)
        }
      } else {
        const result = addUser(userData)
        if (result.success) {
          Modal.success({
            title: '用户创建成功',
            content: (
              <div>
                <p>初始密码：<strong>{generatedPassword}</strong></p>
                <p>请妥善保管并告知用户</p>
              </div>
            ),
            onOk: () => {
              onSuccess()
            },
          })
        } else {
          message.error(result.message)
        }
      }
    } catch {
      // Form validation failed
    }
  }

  return (
    <Modal
      title={user ? '编辑用户' : '新增用户'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="姓名"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input placeholder="请输入姓名" />
        </Form.Item>

        <Form.Item
          name="employeeId"
          label="工号"
          rules={[{ required: true, message: '请输入工号' }]}
        >
          <Input placeholder="请输入工号" disabled={!!user} />
        </Form.Item>

        <Form.Item
          name="phone"
          label="手机号"
          rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
          ]}
        >
          <Input placeholder="请输入手机号" />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱' },
          ]}
        >
          <Input placeholder="请输入邮箱" />
        </Form.Item>

        <Form.Item
          name="departmentId"
          label="部门"
          rules={[{ required: true, message: '请选择部门' }]}
        >
          <Select
            placeholder="请选择部门"
            options={getDepartmentOptions()}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          name="position"
          label="职位"
          rules={[{ required: true, message: '请输入职位' }]}
        >
          <Input placeholder="请输入职位" />
        </Form.Item>

        <Form.Item
          name="hireDate"
          label="入职日期"
          rules={[{ required: true, message: '请选择入职日期' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="roles"
          label="角色"
          rules={[{ required: true, message: '请选择角色' }]}
        >
          <Select
            mode="multiple"
            placeholder="请选择角色"
            options={roles.map((r) => ({ label: r.name, value: r.id }))}
          />
        </Form.Item>

        {!user && (
          <Form.Item name="password" label="初始密码">
            <Space>
              <Input value={generatedPassword} readOnly />
              <Button onClick={handleGeneratePassword}>重新生成</Button>
            </Space>
          </Form.Item>
        )}

        <Form.Item name="status" label="状态">
          <Select
            options={[
              { label: '在职', value: 'active' },
              { label: '停用', value: 'inactive' },
              { label: '离职', value: 'resigned' },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default UserForm
