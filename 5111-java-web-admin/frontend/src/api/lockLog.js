import request from '@/utils/request'

export function getLockLogList(params) {
  return request({
    url: '/equipment-lock-logs/list',
    method: 'get',
    params
  })
}

export function getLockLogsByEquipmentId(equipmentId) {
  return request({
    url: `/equipment-lock-logs/equipment/${equipmentId}`,
    method: 'get'
  })
}

export function getLockLogsByReservationId(reservationId) {
  return request({
    url: `/equipment-lock-logs/reservation/${reservationId}`,
    method: 'get'
  })
}
