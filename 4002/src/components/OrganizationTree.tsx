import React, { useState, useEffect } from 'react'
import {
  Tree,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Tooltip,
  Dropdown,
  Tag,
} from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import { Department } from '../types'
import { useDepartmentStore } from '../stores/departmentStore'
import { useUserStore } from '../stores/userStore'

interface DepartmentNode extends DataNode {
  department: Department
  isOverQuota?: boolean
  userCount?: number
  quota?: number
}

const OrganizationTree: React.FC = () => {
  const {
    departments,
    users,
    loadData,
    getDepartmentTree,
    getDepartmentQuota,
    getDepartmentUsers,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    moveDepartment,
  } = useDepartmentStore()

  const { users: allUsers } = useUserStore()

  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    const tree = getDepartmentTree()
    setExpandedKeys(tree.map((t) => t.id))
  }, [])

  const buildTreeData = (depts: Department[]): DepartmentNode[] => {
    return depts.map((dept) => {
      const quotaInfo = getDepartmentQuota(dept.id)
      return {
        key: dept.id,
        title: (
          <div
            className="department-info"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              paddingRight: 8,
            }}
          >
            <span>
              {dept.name}
              {quotaInfo.isOverQuota && (
                <Tooltip title={`编制超编：${quotaInfo.actual}/${quotaInfo.quota}`}>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />
                </Tooltip>
              )}
            </span>
            <span className="department-stats" style={{ color: '#999', fontSize: 12 }}>
              {quotaInfo.actual}/{quotaInfo.quota}人
              {dept.leaderName && (
                <span style={{ marginLeft: 8, color: '#1890ff' }}>
                  <UserOutlined /> {dept.leaderName}
                </span>
              )}
            </span>
          </div>
        ),
        department: dept,
        isOverQuota: quotaInfo.isOverQuota,
        userCount: quotaInfo.actual,
        quota: quotaInfo.quota,
        children: dept.children ? buildTreeData(dept.children) : [],
      }
    })
  }

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys)
  }

  const handleSelect = (keys: React.Key[]) => {
    setSelectedKeys(keys)
  }

  const handleAdd = (parentDeptId: string | null = null) => {
    setEditingDept(null)
    setParentId(parentDeptId)
    form.resetFields()
    form.setFieldsValue({
      parentId: parentDeptId,
      quota: 10,
      sortOrder: 1,
    })
    setModalVisible(true)
  }

  const handleEdit = (dept: Department) => {
    setEditingDept(dept)
    setParentId(dept.parentId)
    form.setFieldsValue({
      ...dept,
    })
    setModalVisible(true)
  }

  const handleDelete = (dept: Department) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除部门「${dept.name}」吗？`,
      onOk: () => {
        const result = deleteDepartment(dept.id)
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

      if (editingDept) {
        const result = updateDepartment(editingDept.id, values)
        if (result.success) {
          message.success(result.message)
          setModalVisible(false)
          loadData()
        } else {
          message.error(result.message)
        }
      } else {
        const result = addDepartment(values)
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

  const handleDragEnter = (info: { node: EventDataNode<DataNode> }) => {
    setDragOverNodeId(info.node.key as string)
  }

  const handleDragLeave = () => {
    setDragOverNodeId(null)
  }

  const handleDrop = (info: {
    node: EventDataNode<DataNode>
    dragNode: EventDataNode<DataNode>
    dropPosition: number
  }) => {
    const { dragNode, node, dropPosition } = info
    const dragId = dragNode.key as string
    const targetId = node.key as string

    let newParentId: string | null = targetId

    if (dropPosition === -1) {
      const findParent = (items: Department[], id: string): string | null => {
        for (const item of items) {
          if (item.children) {
            if (item.children.some((c) => c.id === id)) {
              return item.id
            }
            const found = findParent(item.children, id)
            if (found) return found
          }
        }
        return null
      }
      newParentId = findParent(departments, targetId)
    } else if (dropPosition === 1) {
      newParentId = targetId
    }

    const result = moveDepartment(dragId, newParentId)
    if (result.success) {
      message.success(result.message)
      loadData()
    } else {
      message.error(result.message)
    }

    setDragOverNodeId(null)
  }

  const getLeaderOptions = () => {
    const selectedDeptId = selectedKeys[0] as string | undefined
    if (!selectedDeptId) return []

    const deptUsers = getDepartmentUsers(selectedDeptId)
    return deptUsers.map((u) => ({
      label: `${u.name} (${u.position})`,
      value: u.id,
    }))
  }

  const getParentOptions = () => {
    const tree = getDepartmentTree()
    const options: { label: string; value: string | null }[] = [
      { label: '根目录', value: null },
    ]

    const traverse = (items: any[], prefix = '') => {
      items.forEach((item) => {
        if (!editingDept || item.department?.id !== editingDept.id) {
          options.push({
            label: prefix + item.department?.name,
            value: item.key,
          })
        }
        if (item.children && item.children.length > 0) {
          traverse(item.children, prefix + (item.department?.name || '') + ' / ')
        }
      })
    }

    traverse(tree)
    return options
  }

  const treeData = buildTreeData(getDepartmentTree())

  const renderDropdown = (dept: Department) => ({
    items: [
      {
        key: 'add',
        label: '添加子部门',
        icon: <PlusOutlined />,
        onClick: () => handleAdd(dept.id),
      },
      {
        key: 'edit',
        label: '编辑',
        icon: <EditOutlined />,
        onClick: () => handleEdit(dept),
      },
      {
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDelete(dept),
      },
    ],
  })

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">组织架构</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd(null)}>
            新增部门
          </Button>
        </Space>
      </div>

      <div className="org-tree-container">
        <Tree
          blockNode
          draggable
          expandedKeys={expandedKeys}
          selectedKeys={selectedKeys}
          treeData={treeData}
          onExpand={handleExpand}
          onSelect={handleSelect}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          titleRender={(nodeData: any) => (
            <Dropdown
              menu={renderDropdown(nodeData.department)}
              trigger={['contextMenu']}
            >
              <div style={{ flex: 1 }}>{nodeData.title}</div>
            </Dropdown>
          )}
        />
      </div>

      <Modal
        title={editingDept ? '编辑部门' : '新增部门'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>

          <Form.Item
            name="parentId"
            label="上级部门"
          >
            <Select
              placeholder="请选择上级部门"
              options={getParentOptions()}
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="leaderId"
            label="部门负责人"
          >
            <Select
              placeholder="请选择部门负责人"
              options={getLeaderOptions()}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            name="quota"
            label="编制人数"
            rules={[{ required: true, message: '请输入编制人数' }]}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="sortOrder"
            label="排序"
            rules={[{ required: true, message: '请输入排序号' }]}
          >
            <InputNumber min={1} max={999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrganizationTree
