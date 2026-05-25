import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Tag,
  message,
  Tooltip,
  Tabs,
  Checkbox,
  Select,
  Radio,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Role, MenuPermission, DataPermission } from '../types'
import { useRoleStore } from '../stores/roleStore'
import { useUserStore } from '../stores/userStore'
import { useDepartmentStore } from '../stores/departmentStore'

const RoleManagement: React.FC = () => {
  const {
    roles,
    loadData,
    addRole,
    updateRole,
    deleteRole,
    updateMenuPermission,
    updateDataPermission,
  } = useRoleStore()
  const { users } = useUserStore()
  const { getDepartmentTree, departments } = useDepartmentStore()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [form] = Form.useForm()
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null)
  const [permissionTab, setPermissionTab] = useState<'menu' | 'data'>('menu')

  useEffect(() => {
    loadData()
    useDepartmentStore.getState().loadData()
  }, [])

  const handleAdd = () => {
    setEditingRole(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    form.setFieldsValue(role)
    setModalVisible(true)
  }

  const handleDelete = (role: Role) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色「${role.name}」吗？`,
      onOk: () => {
        const result = deleteRole(role.id)
        if (result.success) {
          message.success(result.message)
          loadData()
        } else {
          message.error(result.message)
        }
      },
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (editingRole) {
        const result = updateRole(editingRole.id, values)
        if (result.success) {
          message.success(result.message)
          setModalVisible(false)
          loadData()
        } else {
          message.error(result.message)
        }
      } else {
        const result = addRole(values)
        if (result.success) {
          message.success(result.message)
          setModalVisible(false)
          loadData()
        } else {
          message.error(result.message)
        }
      }
    } catch {
      // Form validation failed
    }
  }

  const getUserCount = (roleId: string) => {
    return users.filter((u) => u.roles.includes(roleId)).length
  }

  const activeRole = roles.find((r) => r.id === activeRoleId)

  const handleMenuPermissionChange = (
    menuId: string,
    action: keyof MenuPermission,
    checked: boolean
  ) => {
    if (!activeRoleId) return
    updateMenuPermission(activeRoleId, menuId, action, checked)
  }

  const handleDataPermissionChange = (dataPermission: DataPermission) => {
    if (!activeRoleId) return
    updateDataPermission(activeRoleId, dataPermission)
  }

  const getDepartmentOptions = () => {
    const tree = getDepartmentTree()
    const options: { label: string; value: string }[] = []

    const traverse = (items: any[], prefix = '') => {
      items.forEach((item) => {
        options.push({
          label: prefix + item.department?.name,
          value: item.key,
        })
        if (item.children && item.children.length > 0) {
          traverse(item.children, prefix + (item.department?.name || '') + ' / ')
        }
      })
    }

    traverse(tree)
    return options
  }

  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name, record) => (
        <Button
          type="link"
          onClick={() => {
            setActiveRoleId(record.id)
            setPermissionTab('menu')
          }}
        >
          {name}
          {record.isSystem && <Tag color="gold" style={{ marginLeft: 8 }}>系统</Tag>}
        </Button>
      ),
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '用户数',
      key: 'userCount',
      width: 100,
      render: (_, record) => (
        <Tag color={getUserCount(record.id) > 0 ? 'blue' : 'default'}>
          <TeamOutlined /> {getUserCount(record.id)}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {!record.isSystem && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Popconfirm
                title="确定删除该角色？"
                onConfirm={() => handleDelete(record)}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  const menuItems = [
    { id: 'user', name: '用户管理' },
    { id: 'department', name: '部门管理' },
    { id: 'role', name: '角色管理' },
    { id: 'permission', name: '权限配置' },
    { id: 'log', name: '操作日志' },
  ]

  const getMenuPermission = (menuId: string): MenuPermission | undefined => {
    return activeRole?.menuPermissions.find((p) => p.menuId === menuId)
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">角色管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增角色
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        pagination={false}
        scroll={{ x: 800 }}
      />

      {activeRole && (
        <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>
              <SafetyOutlined style={{ marginRight: 8 }} />
              {activeRole.name} - 权限配置
            </h3>
          </div>

          <Tabs
            activeKey={permissionTab}
            onChange={(key) => setPermissionTab(key as 'menu' | 'data')}
            items={[
              {
                key: 'menu',
                label: '菜单权限',
                children: (
                  <div className="permission-matrix">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                          <th style={tableHeaderStyle}>功能模块</th>
                          <th style={tableHeaderStyle}>查看</th>
                          <th style={tableHeaderStyle}>新增</th>
                          <th style={tableHeaderStyle}>编辑</th>
                          <th style={tableHeaderStyle}>删除</th>
                        </tr>
                      </thead>
                      <tbody>
                        {menuItems.map((menu) => {
                          const perm = getMenuPermission(menu.id)
                          return (
                            <tr key={menu.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={tableCellStyle}>
                                <strong>{menu.name}</strong>
                              </td>
                              <td style={tableCellStyle}>
                                <Checkbox
                                  checked={perm?.canView || false}
                                  onChange={(e) =>
                                    handleMenuPermissionChange(menu.id, 'canView', e.target.checked)
                                  }
                                />
                              </td>
                              <td style={tableCellStyle}>
                                <Checkbox
                                  checked={perm?.canAdd || false}
                                  onChange={(e) =>
                                    handleMenuPermissionChange(menu.id, 'canAdd', e.target.checked)
                                  }
                                />
                              </td>
                              <td style={tableCellStyle}>
                                <Checkbox
                                  checked={perm?.canEdit || false}
                                  onChange={(e) =>
                                    handleMenuPermissionChange(menu.id, 'canEdit', e.target.checked)
                                  }
                                />
                              </td>
                              <td style={tableCellStyle}>
                                <Checkbox
                                  checked={perm?.canDelete || false}
                                  onChange={(e) =>
                                    handleMenuPermissionChange(menu.id, 'canDelete', e.target.checked)
                                  }
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ),
              },
              {
                key: 'data',
                label: '数据权限',
                children: (
                  <div>
                    <Form layout="vertical">
                      <Form.Item label="数据权限类型">
                        <Radio.Group
                          value={activeRole.dataPermissions.type}
                          onChange={(e) =>
                            handleDataPermissionChange({
                              ...activeRole.dataPermissions,
                              type: e.target.value,
                            })
                          }
                        >
                          <Radio value="all">全部数据</Radio>
                          <Radio value="department">本部门数据</Radio>
                          <Radio value="departmentAndChildren">本部门及下属部门</Radio>
                          <Radio value="self">仅本人数据</Radio>
                          <Radio value="custom">自定义</Radio>
                        </Radio.Group>
                      </Form.Item>

                      {activeRole.dataPermissions.type === 'custom' && (
                        <Form.Item label="可访问部门">
                          <Select
                            mode="multiple"
                            value={activeRole.dataPermissions.departmentIds}
                            onChange={(value) =>
                              handleDataPermissionChange({
                                ...activeRole.dataPermissions,
                                departmentIds: value,
                              })
                            }
                            options={getDepartmentOptions()}
                            placeholder="请选择可访问的部门"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      )}
                    </Form>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>

          <Form.Item
            name="code"
            label="角色编码"
            rules={[{ required: true, message: '请输入角色编码' }]}
          >
            <Input placeholder="请输入角色编码" disabled={!!editingRole} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入角色描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  borderBottom: '2px solid #d9d9d9',
  fontWeight: 500,
}

const tableCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
}

export default RoleManagement
