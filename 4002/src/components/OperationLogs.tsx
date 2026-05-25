import React, { useState, useEffect } from 'react'
import {
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Tooltip,
  Modal,
  Descriptions,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { OperationLog } from '../types'
import { useUserStore } from '../stores/userStore'
import { formatDateTime } from '../utils/helpers'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const OperationLogs: React.FC = () => {
  const { logs, loadData } = useUserStore()

  const [searchParams, setSearchParams] = useState({
    userName: '',
    action: '',
    targetType: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
    page: 1,
    pageSize: 10,
  })
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const handleSearch = () => {
    setSearchParams((prev) => ({ ...prev, page: 1 }))
  }

  const handleReset = () => {
    setSearchParams({
      userName: '',
      action: '',
      targetType: '',
      dateRange: null,
      page: 1,
      pageSize: 10,
    })
  }

  const handleViewDetail = (log: OperationLog) => {
    setSelectedLog(log)
    setDetailVisible(true)
  }

  const getActionColor = (action: string) => {
    const colorMap: Record<string, string> = {
      新增用户: 'green',
      修改用户: 'blue',
      删除用户: 'red',
      重置密码: 'orange',
      批量导入: 'purple',
      登录: 'cyan',
      新增部门: 'green',
      修改部门: 'blue',
      删除部门: 'red',
      新增角色: 'green',
      修改角色: 'blue',
      删除角色: 'red',
    }
    return colorMap[action] || 'default'
  }

  const getTargetTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      user: 'blue',
      department: 'green',
      role: 'orange',
    }
    return colorMap[type] || 'default'
  }

  const getTargetTypeName = (type: string) => {
    const nameMap: Record<string, string> = {
      user: '用户',
      department: '部门',
      role: '角色',
    }
    return nameMap[type] || type
  }

  const filteredLogs = logs.filter((log) => {
    if (searchParams.userName && !log.userName.includes(searchParams.userName)) {
      return false
    }
    if (searchParams.action && log.action !== searchParams.action) {
      return false
    }
    if (searchParams.targetType && log.targetType !== searchParams.targetType) {
      return false
    }
    if (searchParams.dateRange && searchParams.dateRange.length === 2) {
      const logDate = dayjs(log.createdAt)
      const [start, end] = searchParams.dateRange
      if (logDate.isBefore(start.startOf('day')) || logDate.isAfter(end.endOf('day'))) {
        return false
      }
    }
    return true
  })

  const paginatedLogs = filteredLogs.slice(
    (searchParams.page - 1) * searchParams.pageSize,
    searchParams.page * searchParams.pageSize
  )

  const columns: ColumnsType<OperationLog> = [
    {
      title: '操作人',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (name) => (
        <Space>
          <UserOutlined />
          {name}
        </Space>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action) => <Tag color={getActionColor(action)}>{action}</Tag>,
    },
    {
      title: '操作对象',
      key: 'target',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tag color={getTargetTypeColor(record.targetType)}>
            {getTargetTypeName(record.targetType)}
          </Tag>
          {record.targetName && <span>{record.targetName}</span>}
        </Space>
      ),
    },
    {
      title: '操作详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (detail) => (
        <Tooltip title={detail}>
          <span>{detail}</span>
        </Tooltip>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (date) => (
        <Space>
          <ClockCircleOutlined />
          {formatDateTime(date)}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          />
        </Tooltip>
      ),
    },
  ]

  const actionOptions = [
    ...new Set(logs.map((log) => log.action)),
  ].map((action) => ({ label: action, value: action }))

  const targetTypeOptions = [
    { label: '用户', value: 'user' },
    { label: '部门', value: 'department' },
    { label: '角色', value: 'role' },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">操作日志</h2>
      </div>

      <div className="search-bar">
        <Space wrap>
          <Input
            placeholder="搜索操作人"
            prefix={<SearchOutlined />}
            value={searchParams.userName}
            onChange={(e) => setSearchParams((prev) => ({ ...prev, userName: e.target.value }))}
            style={{ width: 150 }}
            allowClear
          />
          <Select
            placeholder="操作类型"
            value={searchParams.action}
            onChange={(value) => setSearchParams((prev) => ({ ...prev, action: value }))}
            style={{ width: 150 }}
            allowClear
            options={actionOptions}
          />
          <Select
            placeholder="操作对象类型"
            value={searchParams.targetType}
            onChange={(value) => setSearchParams((prev) => ({ ...prev, targetType: value }))}
            style={{ width: 150 }}
            allowClear
            options={targetTypeOptions}
          />
          <RangePicker
            value={searchParams.dateRange}
            onChange={(dates) =>
              setSearchParams((prev) => ({
                ...prev,
                dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] | null,
              }))
            }
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={paginatedLogs}
        rowKey="id"
        pagination={{
          current: searchParams.page,
          pageSize: searchParams.pageSize,
          total: filteredLogs.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) =>
            setSearchParams((prev) => ({ ...prev, page, pageSize })),
        }}
        scroll={{ x: 1000 }}
      />

      <Modal
        title="操作详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        {selectedLog && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="操作人">{selectedLog.userName}</Descriptions.Item>
            <Descriptions.Item label="操作类型">
              <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="操作对象">
              <Space>
                <Tag color={getTargetTypeColor(selectedLog.targetType)}>
                  {getTargetTypeName(selectedLog.targetType)}
                </Tag>
                {selectedLog.targetName}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="操作详情">{selectedLog.detail}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{selectedLog.ip}</Descriptions.Item>
            <Descriptions.Item label="操作时间">
              {formatDateTime(selectedLog.createdAt)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default OperationLogs
