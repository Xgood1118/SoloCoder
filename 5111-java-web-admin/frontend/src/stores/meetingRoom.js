import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAllActiveRooms } from '@/api/meetingRoom'

export const useMeetingRoomStore = defineStore('meetingRoom', () => {
  const roomList = ref([])
  const loaded = ref(false)

  async function loadRooms(force = false) {
    if (loaded.value && !force) return
    try {
      const data = await getAllActiveRooms()
      roomList.value = data
      loaded.value = true
    } catch (error) {
      console.error('加载会议室列表失败:', error)
    }
  }

  function getRoomById(id) {
    return roomList.value.find(room => room.id === id)
  }

  function clear() {
    roomList.value = []
    loaded.value = false
  }

  return {
    roomList,
    loaded,
    loadRooms,
    getRoomById,
    clear
  }
})
