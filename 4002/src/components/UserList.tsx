import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Popover,
  Checkbox,
  Tag,
  Tooltip,
  Dropdown,
  Modal,
  message,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
  DownloadOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  ExportOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { User, ColumnConfig, SearchParams } from '../types'
import { useUserStore } from '../stores/userStore'
import { useDepartmentStore } from '../stores/departmentStore'
import { storage } from '../utils/storage'
import { formatDate, formatDateTime, downloadFile } from '../utils/helpers'
import UserForm from './UserForm'
import ImportDialog from './ImportDialog'

interface Props {
  onEdit: (user: User) => void
}

const defaultColumnConfig: ColumnConfig[] = [
  { key: 'name', title: '姓名', visible: true, width: 100 },
  { key: 'employeeId', title: '工号', visible: true, width: 120 },
  { key: 'phone', title: '手机号', visible: true, width: 130 },
  { key: 'email', title: '邮箱', visible: true, width: 180 },
  { key: 'departmentName', title: '部门', visible: true, width: 120 },
  { key: 'position', title: '职位', visible: true, width: 120 },
  { key: 'roles', title: '角色', visible: true, width: 150 },
  { key: 'hireDate', title: '入职日期', visible: true, width: 120 },
  { key: 'status', title: '状态', visible: true, width: 80 },
  { key: 'lastLoginTime', title: '最近登录', visible: false, width: 160 },
  { key: 'createdAt', title: '创建时间', visible: false, width: 160 },
  { key: 'actions', title: '操作', visible: true, width: 180, fixed: 'right' as const },
]

const UserList: React.FC<Props> = ({ onEdit }) => {
  const {
    users,
    roles,
    currentUser,
    loadData,
    searchUsers,
    deleteUser,
    resetPassword,
    exportUsers,
    getVisiblePhone,
    hasPermission,
  } = useUserStore()

  const { departments, getDepartmentTree, getChildDepartmentIds } = useDepartmentStore()

  const [searchParams, setSearchParams] = useState<SearchParams>({
    page: 1,
    pageSize: 10,
  })
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumnConfig)
  const [formVisible, setFormVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [importVisible, setImportVisible] = useState(false)

  useEffect(() => {
    loadData()
    const savedConfig = storage.getColumnConfig()
    if (savedConfig) {
      setColumnConfig(savedConfig)
    }
  }, [])

  useEffect(() => {
    useDepartmentStore.getState().loadData()
  }, [])

  const handleSearch = useCallback(() => {
    setSearchParams((prev) => ({ ...prev, page: 1 }))
  }, [])

  const handleReset = () => {
    setSearchParams({
      page: 1,
      pageSize: 10,
    })
  }

  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    setSearchParams((prev) => ({
      ...prev,
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortField: sorter.field,
      sortOrder: sorter.order,
    }))
  }

  const handleColumnConfigChange = (key: string, visible: boolean) => {
    const newConfig = columnConfig.map((c) =>
      c.key === key ? { ...c, visible } : c
    )
    setColumnConfig(newConfig)
    storage.setColumnConfig(newConfig)
  }

  const handleResetColumns = () => {
    setColumnConfig(defaultColumnConfig)
    storage.setColumnConfig(defaultColumnConfig)
  }

  const handleAdd = () => {
    setEditingUser(null)
    setFormVisible(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormVisible(true)
    onEdit(user)
  }

  const handleDelete = (user: User) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户「${user.name}」吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const result = deleteUser(user.id)
        if (result.success) {
          message.success(result.message)
        } else {
          message.error(result.message)
        }
      },
    })
  }

  const handleResetPassword = (user: User) => {
    Modal.confirm({
      title: '重置密码',
      content: `确定要重置用户「${user.name}」的密码吗？新密码将随机生成。`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const result = resetPassword(user.id)
        if (result.success) {
          Modal.success({
            title: '密码重置成功',
            content: `新密码：${result.password}`,
          })
        } else {
          message.error(result.message)
        }
      },
    })
  }

  const handleExport = () => {
    const data = exportUsers(searchParams)
    const csvContent = [
      ['姓名', '工号', '手机号', '邮箱', '部门', '职位', '入职日期', '状态'].join(','),
      ...data.map((u) =>
        [
          u.name,
          u.employeeId,
          getVisiblePhone(u.id),
          u.email,
          u.departmentName,
          u.position,
          u.hireDate,
          u.status === 'active' ? '在职' : u.status === 'inactive' ? '停用' : '离职',
        ].join(',')
      ),
    ].join('\n')

    downloadFile(csvContent, `用户列表_${new Date().toLocaleDateString()}.csv`, 'text/csv')
  }

  const result = searchUsers(searchParams)

  const getRoleName = (roleId: string) => {
    return roles.find((r) => r.id === roleId)?.name || roleId
  }

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

  const columns: ColumnsType<User> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      sorter: true,
      fixed: 'left' as const,
    },
    {
      title: '工号',
      dataIndex: 'employeeId',
      key: 'employeeId',
      width: 120,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (_: any, record: User) => getVisiblePhone(record.id),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      ellipsis: true,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120,
    },
    {
      title: '职位',
      dataIndex: 'position',
      key: 'position',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 150,
      render: (roleIds: string[]) => (
        <>
          {roleIds.map((id) => (
            <Tag key={id} color="blue" className="role-badge">
              {getRoleName(id)}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '入职日期',
      dataIndex: 'hireDate',
      key: 'hireDate',
      width: 120,
      sorter: true,
      render: (date: string) => formatDate(date),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const colorMap = {
          active: 'green',
          inactive: 'default',
          resigned: 'red',
        }
        const textMap = {
          active: '在职',
          inactive: '停用',
          resigned: '离职',
        }
        return <Tag color={colorMap[status as keyof typeof colorMap]}>{textMap[status as keyof typeof textMap]}</Tag>
      },
    },
    {
      title: '最近登录',
      dataIndex: 'lastLoginTime',
      key: 'lastLoginTime',
      width: 160,
      sorter: true,
      render: (date: string | null) => formatDateTime(date),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space>
          {hasPermission('user', 'canEdit') && (
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {hasPermission('user', 'canEdit') && (
            <Tooltip title="重置密码">
              <Button
                type="link"
                size="small"
                icon={<KeyOutlined />}
                onClick={() => handleResetPassword(record)}
              />
            </Tooltip>
          )}
          {hasPermission('user', 'canDelete') && (
            <Tooltip title="删除">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ].filter((col) => columnConfig.find((c) => c.key === col.key)?.visible !== false)

  const columnSettingsContent = (
    <div className="column-settings-popover">
      <div style={{ marginBottom: 12, fontWeight: 500 }}>列显示设置</div>
      {defaultColumnConfig.map((col) => (
        <div key={col.key} className="column-settings-item">
          <span>{col.title}</span>
          <Checkbox
            checked={columnConfig.find((c) => c.key === col.key)?.visible ?? true}
            onChange={(e) => handleColumnConfigChange(col.key, e.target.checked)}
          />
        </div>
      ))}
      <Button type="link" size="small" onClick={handleResetColumns} style={{ marginTop: 8 }}>
        恢复默认
      </Button>
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">用户管理</h2>
      </div>

      <div className="search-bar">
        <Space wrap>
          <Input
            placeholder="搜索姓名"
            prefix={<SearchOutlined />}
            value={searchParams.name}
            onChange={(e) => setSearchParams((prev) => ({ ...prev, name: e.target.value }))}
            style={{ width: 150 }}
            allowClear
          />
          <Input
            placeholder="搜索工号"
            prefix={<SearchOutlined />}
            value={searchParams.employeeId}
            onChange={(e) => setSearchParams((prev) => ({ ...prev, employeeId: e.target.value }))}
            style={{ width: 150 }}
            allowClear
          />
          <Select
            placeholder="选择部门"
            value={searchParams.departmentId}
            onChange={(value) => setSearchParams((prev) => ({ ...prev, departmentId: value }))}
            style={{ width: 200 }}
            allowClear
            options={getDepartmentOptions()}
          />
          <Select
            placeholder="选择角色"
            value={searchParams.roleId}
            onChange={(value) => setSearchParams((prev) => ({ ...prev, roleId: value }))}
            style={{ width: 150 }}
            allowClear
            options={roles.map((r) => ({ label: r.name, value: r.id }))}
          />
          <Select
            placeholder="状态"
            value={searchParams.status}
            onChange={(value) => setSearchParams((prev) => ({ ...prev, status: value }))}
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '在职', value: 'active' },
              { label: '停用', value: 'inactive' },
              { label: '离职', value: 'resigned' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      <div className="table-toolbar">
        <div className="toolbar-left">
          {hasPermission('user', 'canAdd') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增用户
            </Button>
          )}
          {hasPermission('user', 'canAdd') && (
            <Button icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>
              批量导入
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            批量导出
          </Button>
        </div>
        <div className="toolbar-right">
          <Popover
            content={columnSettingsContent}
            title="列设置"
            trigger="click"
          >
            <Button icon={<SettingOutlined />}>列设置</Button>
          </Popover>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={result.data}
        rowKey="id"
        pagination={{
          current: result.page,
          pageSize: result.pageSize,
          total: result.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1200 }}
      />

      {formVisible && (
        <UserForm
          visible={formVisible}
          user={editingUser}
          onClose={() => setFormVisible(false)}
          onSuccess={() => {
            setFormVisible(false)
            loadData()
          }}
        />
      )}

      {importVisible && (
        <ImportDialog
          visible={importVisible}
          onClose={() => setImportVisible(false)}
          onSuccess={() => {
            setImportVisible(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

export default UserList
