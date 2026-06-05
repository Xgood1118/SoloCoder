import { useState, useEffect } from 'react'
import { Form, Input, InputNumber, DatePicker, Select, Button, Card, message, Table } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { warehouseApi, stockApi, productApi, Warehouse } from '../services/api'
import dayjs from 'dayjs'

interface ProductOption {
  id: number
  name: string
  code: string
  totalQuantity: number
}

export default function StockOut() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | undefined>()

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

  const searchProducts = async () => {
    if (!selectedWarehouse) {
      message.warning('请先选择仓库')
      return
    }
    setSearching(true)
    try {
      const result: any = await productApi.getList({
        name: searchKeyword,
        warehouseId: selectedWarehouse
      })
      setProducts(result.content || [])
    } catch (error) {
      console.error('搜索商品失败:', error)
    } finally {
      setSearching(false)
    }
  }

  const onFinish = async (values: any) => {
    if (!selectedProduct) {
      message.error('请先选择要出库的商品')
      return
    }
    if (values.quantity > selectedProduct.totalQuantity) {
      message.error(`库存不足，当前库存: ${selectedProduct.totalQuantity}`)
      return
    }
    setLoading(true)
    try {
      const params = {
        ...values,
        productId: selectedProduct.id,
        warehouseId: selectedWarehouse,
        outTime: values.outTime ? dayjs(values.outTime).format('YYYY-MM-DD HH:mm:ss') : undefined
      }
      await stockApi.stockOut(params)
      message.success('出库成功')
      form.resetFields()
      setSelectedProduct(null)
      setProducts([])
      setSearchKeyword('')
    } catch (error) {
      console.error('出库失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const productColumns = [
    { title: '商品名称', dataIndex: 'name', key: 'name' },
    { title: '商品编码', dataIndex: 'code', key: 'code' }
  ]

  return (
    <div>
      <Card title="选择商品" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择出库仓库"
            style={{ width: 200, marginRight: 8 }}
            value={selectedWarehouse}
            onChange={val => {
              setSelectedWarehouse(val)
              setSelectedProduct(null)
              setProducts([])
            }}
            allowClear
          >
            {warehouses.map(w => (
              <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
            ))}
          </Select>
          <Input
            placeholder="输入商品名称搜索"
            prefix={<SearchOutlined />}
            style={{ width: 250, marginRight: 8 }}
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            onPressEnter={searchProducts}
            allowClear
          />
          <Button type="primary" onClick={searchProducts} loading={searching}>
            搜索
          </Button>
        </div>

        {products.length > 0 && (
          <Table
            columns={productColumns}
            dataSource={products}
            rowKey="id"
            pagination={false}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedProduct ? [selectedProduct.id] : [],
              onChange: (keys, rows) => {
                setSelectedProduct(rows[0] as ProductOption)
                form.setFieldValue('quantity', null)
              }
            }}
            scroll={{ y: 200 }}
          />
        )}

        {selectedProduct && (
          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <strong>已选择：</strong> {selectedProduct.name}（{selectedProduct.code}）-
            <span style={{ color: '#1890ff' }}> 当前库存: {selectedProduct.totalQuantity}</span>
          </div>
        )}
      </Card>

      <Card title="出库信息">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 600 }}
        >
          <Form.Item
            name="quantity"
            label="出库数量"
            rules={[{ required: true, message: '请输入出库数量' }]}
          >
            <InputNumber
              min={1}
              max={selectedProduct?.totalQuantity || 999999}
              style={{ width: '100%' }}
              placeholder="请输入出库数量"
              disabled={!selectedProduct}
            />
          </Form.Item>

          <Form.Item
            name="department"
            label="领用部门"
            rules={[{ required: true, message: '请输入领用部门' }]}
          >
            <Input placeholder="请输入领用部门" />
          </Form.Item>

          <Form.Item
            name="receiver"
            label="领用人"
            rules={[{ required: true, message: '请输入领用人' }]}
          >
            <Input placeholder="请输入领用人姓名" />
          </Form.Item>

          <Form.Item name="outTime" label="出库时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="默认为当前时间" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              disabled={!selectedProduct}
            >
              确认出库
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
