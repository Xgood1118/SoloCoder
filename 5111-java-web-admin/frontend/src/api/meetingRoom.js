import request from '@/utils/request'

export function getMeetingRoomList(params) {
  return request({
    url: '/meeting-rooms/list',
    method: 'get',
    params
  })
}

export function getAllActiveRooms() {
  return request({
    url: '/meeting-rooms/all',
    method: 'get'
  })
}

export function getMeetingRoomById(id) {
  return request({
    url: `/meeting-rooms/${id}`,
    method: 'get'
  })
}

export function createMeetingRoom(data) {
  return request({
    url: '/meeting-rooms',
    method: 'post',
    data
  })
}

export function updateMeetingRoom(id, data) {
  return request({
    url: `/meeting-rooms/${id}`,
    method: 'put',
    data
  })
}

export function deleteMeetingRoom(id) {
  return request({
    url: `/meeting-rooms/${id}`,
    method: 'delete'
  })
}

export function getAvailableRooms(startTime, endTime) {
  return request({
    url: '/meeting-rooms/available',
    method: 'get',
    params: { startTime, endTime }
  })
}

export function getAvailableRoomsWithFilter(data) {
  return request({
    url: '/meeting-rooms/available/filter',
    method: 'post',
    data
  })
}
