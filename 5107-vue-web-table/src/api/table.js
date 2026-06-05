import request from '@/utils/request'

export const fetchTableData = (params) => {
  return request({
    url: '/table/data',
    method: 'post',
    data: params
  })
}

export const fetchAllTableData = (params) => {
  return request({
    url: '/table/data/all',
    method: 'post',
    data: params
  })
}

export const saveColumnConfig = (tableKey, config) => {
  return request({
    url: '/table/column-config',
    method: 'post',
    data: { tableKey, config }
  })
}

export const getColumnConfig = (tableKey) => {
  return request({
    url: `/table/column-config/${tableKey}`,
    method: 'get'
  })
}

export const batchUpdate = (params) => {
  return request({
    url: '/table/batch-update',
    method: 'post',
    data: params
  })
}

export const batchDelete = (params) => {
  return request({
    url: '/table/batch-delete',
    method: 'post',
    data: params
  })
}

export const mockFetchTableData = (params) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockData = generateMockData(params)
      resolve({
        code: 200,
        data: mockData
      })
    }, 300)
  })
}

const generateMockData = (params) => {
  const { page = 1, pageSize = 20, sorts = [], filters = {}, dedupFields = [] } = params
  
  const allData = []
  const businessTypes = ['订单', '退款', '换货', '维修', '咨询']
  const statuses = ['待处理', '处理中', '已完成', '已取消']
  const regions = ['华东', '华北', '华南', '西南', '西北', '东北', '华中']
  const products = ['产品A', '产品B', '产品C', '产品D', '产品E']
  
  for (let i = 1; i <= 256; i++) {
    const date = new Date(2024, 0, 1)
    date.setDate(date.getDate() + Math.floor(Math.random() * 180))
    
    allData.push({
      id: i,
      businessId: `BIZ${String(Math.floor(i / 3)).padStart(6, '0')}`,
      orderNo: `ORD${String(i).padStart(8, '0')}`,
      businessType: businessTypes[Math.floor(Math.random() * businessTypes.length)],
      amount: Number((Math.random() * 10000 + 100).toFixed(2)),
      quantity: Math.floor(Math.random() * 100 + 1),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      product: products[Math.floor(Math.random() * products.length)],
      customerName: `客户${i}`,
      phone: `1${Math.floor(Math.random() * 9 + 3)}${String(Math.floor(Math.random() * 1000000000)).padStart(9, '0')}`,
      createTime: date.toISOString(),
      updateTime: date.toISOString(),
      operator: `员工${Math.floor(Math.random() * 50 + 1)}`,
      remark: Math.random() > 0.5 ? `备注信息${i}` : ''
    })
  }
  
  let filteredData = [...allData]
  
  if (filters) {
    Object.entries(filters).forEach(([key, filter]) => {
      if (!filter || (typeof filter === 'object' && Object.values(filter).every(v => !v))) {
        return
      }
      
      filteredData = filteredData.filter(item => {
        const value = item[key]
        
        if (typeof filter === 'string') {
          return String(value).toLowerCase().includes(filter.toLowerCase())
        }
        
        if (filter.type === 'text' && filter.value) {
          return String(value).toLowerCase().includes(filter.value.toLowerCase())
        }
        
        if (filter.type === 'number') {
          const numValue = Number(value)
          if (filter.min !== undefined && filter.min !== '' && numValue < Number(filter.min)) return false
          if (filter.max !== undefined && filter.max !== '' && numValue > Number(filter.max)) return false
          return true
        }
        
        if (filter.type === 'date') {
          const dateValue = new Date(value).getTime()
          if (filter.start) {
            const start = new Date(filter.start).getTime()
            if (dateValue < start) return false
          }
          if (filter.end) {
            const end = new Date(filter.end)
            end.setHours(23, 59, 59, 999)
            if (dateValue > end.getTime()) return false
          }
          return true
        }
        
        if (filter.type === 'select' && filter.value) {
          return value === filter.value
        }
        
        return true
      })
    })
  }
  
  if (dedupFields && dedupFields.length > 0) {
    const seen = new Set()
    filteredData = filteredData.filter(item => {
      const key = dedupFields.map(f => item[f]).join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  
  if (sorts && sorts.length > 0) {
    filteredData.sort((a, b) => {
      for (const sort of sorts) {
        const aVal = a[sort.prop]
        const bVal = b[sort.prop]
        
        if (aVal === bVal) continue
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.order === 'ascending' ? aVal - bVal : bVal - aVal
        }
        
        const comparison = String(aVal).localeCompare(String(bVal))
        return sort.order === 'ascending' ? comparison : -comparison
      }
      return 0
    })
  }
  
  const total = filteredData.length
  const start = (page - 1) * pageSize
  const list = filteredData.slice(start, start + pageSize)
  
  return {
    list,
    total,
    page,
    pageSize
  }
}
