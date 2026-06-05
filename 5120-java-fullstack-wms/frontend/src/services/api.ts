import request from '../utils/request'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  username: string
  realName: string
  role: string
  warehouseId: number | null
}

export interface StockInParams {
  productName: string
  productCode?: string
  quantity: number
  batchNo: string
  productionDate?: string
  expiryDate?: string
  supplier?: string
  warehouseId: number
  productUnit?: string
  warningThreshold?: number
  remark?: string
  inTime?: string
}

export interface StockOutParams {
  productId: number
  quantity: number
  warehouseId: number
  department: string
  receiver: string
  remark?: string
  outTime?: string
}

export interface InventoryItem {
  id: number
  productId: number
  productName: string
  productCode: string
  category?: string
  unit: string
  warehouseId: number
  warehouseName: string
  totalQuantity: number
  warningThreshold: number
  lastInTime?: string
  lastOutTime?: string
  updatedAt: string
}

export interface BatchItem {
  id: number
  batchNo: string
  productId: number
  warehouseId: number
  productionDate?: string
  expiryDate?: string
  supplier?: string
  totalQuantity: number
  availableQuantity: number
  unitPrice: number
  remark?: string
  createdAt: string
}

export interface Warehouse {
  id: number
  name: string
  code: string
  location?: string
  manager?: string
}

export const authApi = {
  login: (params: LoginParams) =>
    request.post<any, LoginResult>('/auth/login', params)
}

export const stockApi = {
  stockIn: (params: StockInParams) =>
    request.post('/stock/in', params),
  stockOut: (params: StockOutParams) =>
    request.post('/stock/out', params)
}

export const inventoryApi = {
  getList: (params: { productName?: string; warehouseId?: number; page?: number; size?: number }) =>
    request.get<any, { content: InventoryItem[]; totalElements: number }>('/inventory/list', { params })
}

export const batchApi = {
  getList: (params: { warehouseId?: number; page?: number; size?: number }) =>
    request.get<any, { content: BatchItem[]; totalElements: number }>('/batch/list', { params }),
  getByProductId: (productId: number) =>
    request.get<any, BatchItem[]>(`/batch/product/${productId}`),
  getRecordsByBatchNo: (batchNo: string) =>
    request.get(`/batch/records/${batchNo}`)
}

export const warehouseApi = {
  getList: () =>
    request.get<any, Warehouse[]>('/warehouse/list')
}

export const productApi = {
  getList: (params: { name?: string; warehouseId?: number; page?: number; size?: number }) =>
    request.get('/product/list', { params })
}

export const exportApi = {
  exportInventory: (params?: { productName?: string; warehouseId?: number }) => {
    const query = new URLSearchParams()
    if (params?.productName) query.append('productName', params.productName)
    if (params?.warehouseId) query.append('warehouseId', String(params.warehouseId))
    window.open(`/api/export/inventory?${query.toString()}`, '_blank')
  },
  exportStockRecords: (params: { startTime: string; endTime: string; warehouseId?: number }) => {
    const query = new URLSearchParams()
    query.append('startTime', params.startTime)
    query.append('endTime', params.endTime)
    if (params.warehouseId) query.append('warehouseId', String(params.warehouseId))
    window.open(`/api/export/stock-records?${query.toString()}`, '_blank')
  }
}
