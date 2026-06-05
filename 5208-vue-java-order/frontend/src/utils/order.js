import dayjs from 'dayjs'

export const OrderStatus = {
  '待支付': 'PENDING_PAYMENT',
  '已支付': 'PAID',
  '已发货': 'SHIPPED',
  '已收货': 'RECEIVED',
  '已退款': 'REFUNDED',
  '已取消': 'CANCELLED'
}

export const OrderStatusList = [
  { value: '', label: '全部状态' },
  { value: 'PENDING_PAYMENT', label: '待支付' },
  { value: 'PAID', label: '已支付' },
  { value: 'SHIPPED', label: '已发货' },
  { value: 'RECEIVED', label: '已收货' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'CANCELLED', label: '已取消' }
]

export function fenToYuan(fen) {
  if (fen === null || fen === undefined) return '0.00'
  const num = Number(fen) / 100
  return num.toFixed(2)
}

export function yuanToFen(yuan) {
  if (!yuan) return 0
  return Math.round(Number(yuan) * 100)
}

export function formatDateTime(val) {
  if (!val) return '-'
  return dayjs(val).format('YYYY-MM-DD HH:mm:ss')
}

export function getStatusTagType(status) {
  const typeMap = {
    '待支付': 'warning',
    '已支付': 'primary',
    '已发货': 'info',
    '已收货': 'success',
    '已退款': 'danger',
    '已取消': 'info'
  }
  return typeMap[status] || 'info'
}

export function formatFullAddress(address) {
  if (!address) return '-'
  return (address.province || '') + (address.city || '') + (address.district || '') + (address.detail || '')
}

export function generateOrderNo() {
  return 'ORD' + Date.now() + Math.floor(Math.random() * 1000)
}
