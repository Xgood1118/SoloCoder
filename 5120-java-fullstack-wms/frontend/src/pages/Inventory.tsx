import { useState, useEffect } from 'react'
import { Table, Input, Select, Button, Space, Card, Tag } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { inventoryApi, warehouseApi, InventoryItem, Warehouse } from '../services/api'
import dayjs from 'dayjs'

export default function Inventory() {
  const [data, setData] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [filters, setFilters] = useState({
    productName: '',
    warehouseId: undefined as number | undefined,
    page: 0,
    size: 20
  })

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
      const result = await inventoryApi.getList(filters)
      setData(result.content)
      setTotal(result.totalElements)
    } catch (error) {
      console.error('加载库存数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '商品名称', dataIndex: 'productName', key: 'productName' },
    { title: '商品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '当前库存', dataIndex: 'totalQuantity', key: 'totalQuantity',
      render: (val: number, record: InventoryItem) => (
        <Space>
          <span style={{ fontWeight: 'bold' }}>{val}</span>
          {val <= record.warningThreshold && (
            <Tag color="red">低于警戒线</Tag>
          )}
        </Space>
      )
    },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '库存警戒线', dataIndex: 'warningThreshold', key: 'warningThreshold' },
    { title: '所属仓库', dataIndex: 'warehouseName', key: 'warehouseName' },
    { title: '最近入库时间', dataIndex: 'lastInTime', key: 'lastInTime',
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    { title: '最近出库时间', dataIndex: 'lastOutTime', key: 'lastOutTime',
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'
    }
  ]

  return (
    <div>
      <Card title="库存查询" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="商品名称"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.productName}
            onChange={e => setFilters({ ...filters, productName: e.target.value, page: 0 })}
            allowClear
          />
          <Select
            placeholder="选择仓库"
            style={{ width: 150 }}
            value={filters.warehouseId}
            onChange={val => setFilters({ ...filters, warehouseId: val, page: 0 })}
            allowClear
          >
            {warehouses.map(w => (
              <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setFilters({ productName: '', warehouseId: undefined, page: 0, size: 20 })
          }}>
            重置
          </Button>
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
    </div>
  )
}
