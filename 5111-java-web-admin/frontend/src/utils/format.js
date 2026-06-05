import dayjs from 'dayjs'

export function formatDateTime(date) {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

export function formatDate(date) {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

export function formatTime(date) {
  if (!date) return '-'
  return dayjs(date).format('HH:mm:ss')
}

export function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return '-'
  return `${dayjs(startTime).format('YYYY-MM-DD HH:mm')} ~ ${dayjs(endTime).format('HH:mm')}`
}

export function formatWeekendAvailable(value) {
  return value ? '是' : '否'
}

export function formatStatus(status) {
  const statusMap = {
    0: { text: '停用', type: 'info' },
    1: { text: '启用', type: 'success' }
  }
  return statusMap[status] || { text: '未知', type: 'info' }
}

export function formatReservationStatus(status) {
  const statusMap = {
    0: { text: '待确认', type: 'warning' },
    1: { text: '已确认', type: 'success' },
    2: { text: '已取消', type: 'info' },
    3: { text: '已完成', type: 'primary' }
  }
  return statusMap[status] || { text: '未知', type: 'info' }
}

export function formatLockStatus(locked) {
  return locked
    ? { text: '已锁定', type: 'danger' }
    : { text: '未锁定', type: 'success' }
}

export function formatLockType(type) {
  const typeMap = {
    'LOCK': { text: '锁定', type: 'danger' },
    'UNLOCK': { text: '解锁', type: 'success' },
    'FORCE_UNLOCK': { text: '强制解锁', type: 'warning' }
  }
  return typeMap[type] || { text: '未知', type: 'info' }
}
