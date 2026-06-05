import request from '@/utils/request'

export function getReservationList(params) {
  return request({
    url: '/reservations/list',
    method: 'get',
    params
  })
}

export function getReservationById(id) {
  return request({
    url: `/reservations/${id}`,
    method: 'get'
  })
}

export function createReservation(data) {
  return request({
    url: '/reservations',
    method: 'post',
    data
  })
}

export function updateReservation(id, data) {
  return request({
    url: `/reservations/${id}`,
    method: 'put',
    data
  })
}

export function deleteReservation(id, operator) {
  return request({
    url: `/reservations/${id}`,
    method: 'delete',
    params: { operator }
  })
}

export function checkConflict(data) {
  return request({
    url: '/reservations/check-conflict',
    method: 'post',
    data
  })
}

export function cancelReservation(id, operator) {
  return request({
    url: `/reservations/${id}/cancel`,
    method: 'post',
    params: { operator }
  })
}

export function batchCreateReservation(data) {
  return request({
    url: '/reservations/batch',
    method: 'post',
    data
  })
}
