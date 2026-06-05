import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || '')

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password })
    token.value = res.data.access_token
    localStorage.setItem('token', res.data.access_token)
    const userRes = await api.get('/users/me')
    user.value = userRes.data
    localStorage.setItem('user', JSON.stringify(userRes.data))
  }

  async function register(data) {
    await api.post('/auth/register', data)
  }

  async function fetchUser() {
    try {
      const res = await api.get('/users/me')
      user.value = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
    } catch {
      logout()
    }
  }

  function logout() {
    user.value = null
    token.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { user, token, login, register, fetchUser, logout }
})
