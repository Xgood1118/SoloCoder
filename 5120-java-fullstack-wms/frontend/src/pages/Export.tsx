import { useState, useEffect } from 'react'
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Tabs } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { warehouseApi, exportApi, Warehouse } from '../services/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function Export() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadWarehouses()
  }, [])

  const loadWarehouses = async () => {
    try {
      const data = await warehouseApi.getList()
      setWarehouses(data)
    } catch (error) {
      console.error('加载仓库列表失败:', error)
    }
  }

  const handleExportInventory = (values: any) => {
    setLoading(true)
    try {
      exportApi.exportInventory({
        productName: values.productName,
        warehouseId: values.warehouseId
      })
      message.success('导出任务已启动，请等待下载')
    } catch (error) {
      console.error('导出失败:', error)
      message.error('导出失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExportRecords = (values: any) => {
    if (!values.dateRange) {
      message.error('请选择时间范围')
      return
    }
    setLoading(true)
    try {
      const [start, end] = values.dateRange
      exportApi.exportStockRecords({
        startTime: dayjs(start).format('YYYY-MM-DD HH:mm:ss'),
        endTime: dayjs(end).format('YYYY-MM-DD HH:mm:ss'),
        warehouseId: values.warehouseId
      })
      message.success('导出任务已启动，请等待下载')
    } catch (error) {
      console.error('导出失败:', error)
      message.error('导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="数据导出">
      <Tabs
        items={[
          {
            key: 'inventory',
            label: '库存数据导出',
            children: (
              <Form layout="vertical" onFinish={handleExportInventory} style={{ maxWidth: 500 }}>
                <Form.Item name="productName" label="商品名称（可选）">
                  <Input placeholder="导出所有商品可留空" />
                </Form.Item>

                <Form.Item name="warehouseId" label="选择仓库（可选）">
                  <Select placeholder="全部仓库">
                    {warehouses.map(w => (
                      <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<DownloadOutlined />} loading={loading}>
                    导出库存Excel
                  </Button>
                </Form.Item>
              </Form>
            )
          },
          {
            key: 'records',
            label: '出入库记录导出',
            children: (
              <Form layout="vertical" onFinish={handleExportRecords} style={{ maxWidth: 500 }}>
                <Form.Item
                  name="dateRange"
                  label="时间范围"
                  rules={[{ required: true, message: '请选择时间范围' }]}
                >
                  <RangePicker showTime style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="warehouseId" label="选择仓库（可选）">
                  <Select placeholder="全部仓库">
                    {warehouses.map(w => (
                      <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<DownloadOutlined />} loading={loading}>
                    导出记录Excel
                  </Button>
                </Form.Item>
              </Form>
            )
          }
        ]}
      />

      <Card type="inner" title="导出说明" style={{ marginTop: 24 }}>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>系统采用分页导出方式，每次最多导出10000条数据，避免内存溢出</li>
          <li>导出文件格式为 Excel (.xlsx)，可直接用 Excel 打开</li>
          <li>库存数据包含：商品名称、商品编码、当前库存、单位、库存警戒线、仓库名称、最近出入库时间</li>
          <li>出入库记录包含：流水号、类型、商品名称、批次号、仓库名称、数量、操作人等信息</li>
          <li>可根据仓库权限过滤数据，普通用户只能导出所属仓库数据</li>
        </ul>
      </Card>
    </Card>
  )
}
