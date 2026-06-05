import { useState, useEffect } from 'react'
import { Form, Input, InputNumber, DatePicker, Select, Button, Card, message } from 'antd'
import { warehouseApi, stockApi, Warehouse } from '../services/api'
import dayjs from 'dayjs'

export default function StockIn() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

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

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const params = {
        ...values,
        productionDate: values.productionDate ? dayjs(values.productionDate).format('YYYY-MM-DD') : undefined,
        expiryDate: values.expiryDate ? dayjs(values.expiryDate).format('YYYY-MM-DD') : undefined,
        inTime: values.inTime ? dayjs(values.inTime).format('YYYY-MM-DD HH:mm:ss') : undefined
      }
      await stockApi.stockIn(params)
      message.success('入库成功')
      form.resetFields()
    } catch (error) {
      console.error('入库失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="商品入库">
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          name="productName"
          label="商品名称"
          rules={[{ required: true, message: '请输入商品名称' }]}
        >
          <Input placeholder="请输入商品名称" />
        </Form.Item>

        <Form.Item
          name="productCode"
          label="商品编码"
          extra="新商品可自动生成编码"
        >
          <Input placeholder="请输入商品编码（可选）" />
        </Form.Item>

        <Form.Item
          name="quantity"
          label="入库数量"
          rules={[{ required: true, message: '请输入入库数量' }]}
        >
          <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入入库数量" />
        </Form.Item>

        <Form.Item
          name="batchNo"
          label="生产批次"
          rules={[{ required: true, message: '请输入生产批次' }]}
        >
          <Input placeholder="请输入生产批次号" />
        </Form.Item>

        <Form.Item name="productionDate" label="生产日期">
          <DatePicker style={{ width: '100%' }} placeholder="请选择生产日期" />
        </Form.Item>

        <Form.Item name="expiryDate" label="有效期">
          <DatePicker style={{ width: '100%' }} placeholder="请选择有效期" />
        </Form.Item>

        <Form.Item name="supplier" label="供应商">
          <Input placeholder="请输入供应商名称" />
        </Form.Item>

        <Form.Item
          name="warehouseId"
          label="入库仓库"
          rules={[{ required: true, message: '请选择入库仓库' }]}
        >
          <Select placeholder="请选择入库仓库">
            {warehouses.map(w => (
              <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="productUnit" label="计量单位">
          <Input placeholder="如：个、箱、件" defaultValue="个" />
        </Form.Item>

        <Form.Item name="warningThreshold" label="库存警戒线">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入库存警戒线（可选）" />
        </Form.Item>

        <Form.Item name="inTime" label="入库时间">
          <DatePicker showTime style={{ width: '100%' }} placeholder="默认为当前时间" />
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} placeholder="请输入备注信息" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            确认入库
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
