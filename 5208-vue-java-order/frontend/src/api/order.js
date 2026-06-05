import request from '../utils/request'

export function createOrder(data) {
  return request({
    url: '/orders',
    method: 'post',
    data
  })
}

export function getOrderList(params) {
  return request({
    url: '/orders',
    method: 'get',
    params
  })
}

export function getOrderDetail(id) {
  return request({
    url: `/orders/${id}`,
    method: 'get'
  })
}

export function updateOrder(id, data) {
  return request({
    url: `/orders/${id}`,
    method: 'patch',
    data
  })
}

export function payOrder(id) {
  return request({
    url: `/orders/${id}/pay`,
    method: 'post'
  })
}

export function shipOrder(id, data) {
  return request({
    url: `/orders/${id}/ship`,
    method: 'post',
    data
  })
}

export function confirmOrder(id, params) {
  return request({
    url: `/orders/${id}/confirm`,
    method: 'post',
    params
  })
}

export function cancelOrder(id, params) {
  return request({
    url: `/orders/${id}/cancel`,
    method: 'post',
    params
  })
}

export function applyRefund(id, data) {
  return request({
    url: `/orders/${id}/refund`,
    method: 'post',
    data
  })
}

export function auditRefund(refundId, data) {
  return request({
    url: `/orders/refund/${refundId}/audit`,
    method: 'post',
    data
  })
}

export function getOrderLogs(id) {
  return request({
    url: `/orders/${id}/logs`,
    method: 'get'
  })
}

export function addLogistics(id, data) {
  return request({
    url: `/orders/${id}/logistics`,
    method: 'post',
    data
  })
}

export function batchShip(data) {
  return request({
    url: '/orders/batch/ship',
    method: 'post',
    data
  })
}

export function batchConfirm(data) {
  return request({
    url: '/orders/batch/confirm',
    method: 'post',
    data
  })
}

export function exportOrders(params) {
  return request({
    url: '/orders/export/csv',
    method: 'get',
    params,
    responseType: 'blob'
  })
}
