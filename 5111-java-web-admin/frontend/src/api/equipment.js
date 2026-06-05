import request from '@/utils/request'

export function getEquipmentList(params) {
  return request({
    url: '/equipment/list',
    method: 'get',
    params
  })
}

export function getEquipmentById(id) {
  return request({
    url: `/equipment/${id}`,
    method: 'get'
  })
}

export function createEquipment(data) {
  return request({
    url: '/equipment',
    method: 'post',
    data
  })
}

export function updateEquipment(id, data) {
  return request({
    url: `/equipment/${id}`,
    method: 'put',
    data
  })
}

export function deleteEquipment(id) {
  return request({
    url: `/equipment/${id}`,
    method: 'delete'
  })
}

export function bindEquipmentToRoom(equipmentId, roomId) {
  return request({
    url: `/equipment/${equipmentId}/bind/${roomId}`,
    method: 'post'
  })
}

export function unbindEquipment(equipmentId) {
  return request({
    url: `/equipment/${equipmentId}/unbind`,
    method: 'post'
  })
}

export function getEquipmentByRoomId(roomId) {
  return request({
    url: `/equipment/room/${roomId}`,
    method: 'get'
  })
}

export function getUnboundEquipment() {
  return request({
    url: '/equipment/unbound',
    method: 'get'
  })
}

export function forceUnlockEquipment(equipmentId, operator) {
  return request({
    url: `/equipment/${equipmentId}/force-unlock`,
    method: 'post',
    params: { operator }
  })
}
