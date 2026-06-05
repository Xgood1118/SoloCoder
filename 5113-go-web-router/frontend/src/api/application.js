import request from '@/utils/request'

export function createApplication(data) {
  return request({
    url: '/applications',
    method: 'post',
    data
  })
}

export function getMyApplications(params) {
  return request({
    url: '/applications/my',
    method: 'get',
    params
  })
}

export function getApplicationDetail(id) {
  return request({
    url: `/applications/${id}`,
    method: 'get'
  })
}

export function getApprovalHistory(id) {
  return request({
    url: `/applications/${id}/history`,
    method: 'get'
  })
}

export function approve(data) {
  return request({
    url: '/applications/approve',
    method: 'post',
    data
  })
}

export function rollback(data) {
  return request({
    url: '/applications/rollback',
    method: 'post',
    data
  })
}

export function getRollbackNodes(id) {
  return request({
    url: `/applications/${id}/rollback-nodes`,
    method: 'get'
  })
}

export function getMyTasks(params) {
  return request({
    url: '/tasks/my',
    method: 'get',
    params
  })
}
