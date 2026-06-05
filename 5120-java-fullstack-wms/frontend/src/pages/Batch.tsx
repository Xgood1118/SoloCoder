import { useState, useEffect } from 'react'
import { Table, Input, Select, Button, Space, Card, Modal, Tag, message } from 'antd'
import { SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { batchApi, warehouseApi, BatchItem, Warehouse } from '../services/api'
import dayjs from 'dayjs'

export default function Batch() {
  const [data, setData] = useState<BatchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [filters, setFilters] = useState({
    warehouseId: undefined as number | undefined,
    page: 0,
    size: 20
  })
  const [searchBatchNo, setSearchBatchNo] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [batchDetail, setBatchDetail] = useState<any>(null)

  useEffect(() => {
    loadWarehouses()
  }, [])

  useEffect(() => {
    loadData()
  }, [filters])

  const loadWarehouses = async () => {
    try {
      const data = await warehouseApi.getList()
      setWarehouses(data)
    } catch (error) {
      console.error('加载仓库列表失败:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await batchApi.getList(filters)
      setData(result.content)
      setTotal(result.totalElements)
    } catch (error) {
      console.error('加载批次数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchByBatchNo = async () => {
    if (!searchBatchNo) {
      message.warning('请输入批次号')
      return
    }
    setLoading(true)
    try {
      const result = await batchApi.getRecordsByBatchNo(searchBatchNo)
      setBatchDetail(result)
      setModalVisible(true)
    } catch (error) {
      console.error('查询批次详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '批次号', dataIndex: 'batchNo', key: 'batchNo' },
    { title: '商品ID', dataIndex: 'productId', key: 'productId' },
    { title: '入库总数量', dataIndex: 'totalQuantity', key: 'totalQuantity' },
    { title: '可用数量', dataIndex: 'availableQuantity', key: 'availableQuantity',
      render: (val: number) => (
        <Tag color={val > 0 ? 'green' : 'default'}>{val}</Tag>
      )
    },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier' },
    { title: '生产日期', dataIndex: 'productionDate', key: 'productionDate',
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD') : '-'
    },
    { title: '有效期', dataIndex: 'expiryDate', key: 'expiryDate',
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD') : '-'
    },
    { title: '入库时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: BatchItem) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSearchBatchNo(record.batchNo)
            searchByBatchNo()
          }}
        >
          查看记录
        </Button>
      )
    }
  ]

  const recordColumns = [
    { title: '流水号', dataIndex: 'recordNo', key: 'recordNo' },
    { title: '类型', dataIndex: 'type', key: 'type',
      render: (val: string) => val === 'IN' ? '入库' : '出库'
    },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '操作人', dataIndex: 'operatorName', key: 'operatorName' },
    { title: '操作时间', dataIndex: 'operationTime', key: 'operationTime',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    { title: '备注', dataIndex: 'remark', key: 'remark' }
  ]

  return (
    <div>
      <Card title="批次管理" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="按批次号查询"
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchBatchNo}
            onChange={e => setSearchBatchNo(e.target.value)}
            onPressEnter={searchByBatchNo}
            allowClear
          />
          <Button type="primary" onClick={searchByBatchNo} loading={loading}>
            批次号查询
          </Button>
          <Select
            placeholder="选择仓库筛选"
            style={{ width: 150 }}
            value={filters.warehouseId}
            onChange={val => setFilters({ ...filters, warehouseId: val, page: 0 })}
            allowClear
          >
            {warehouses.map(w => (
              <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
            ))}
          </Select>
        </Space>
      </Card>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page + 1,
          pageSize: filters.size,
          total,
          onChange: (page, size) => setFilters({ ...filters, page: page - 1, size })
        }}
      />

      <Modal
        title="批次操作记录"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {batchDetail?.batches?.map((batch: any, index: number) => (
          <div key={index} style={{ marginBottom: 16 }}>
            <p><strong>批次号：</strong>{batch.batchNo}</p>
            <p><strong>可用数量：</strong>{batch.availableQuantity} / {batch.totalQuantity}</p>
          </div>
        ))}
        <h4 style={{ marginBottom: 12 }}>操作记录：</h4>
        <Table
          columns={recordColumns}
          dataSource={batchDetail?.records || []}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  )
}
