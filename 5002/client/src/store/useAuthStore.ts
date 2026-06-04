import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/axios'
import { User, ApiResponse } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchCurrentUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async (username: string, password: string) => {
        const response = await api.post<ApiResponse<{ token: string; user: User }>>(
          '/auth/login',
          { username, password }
        )
        const { token, user } = response.data.data!
        set({ token, user })
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
      },
      logout: () => {
        set({ token: null, user: null })
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      },
      fetchCurrentUser: async () => {
        const response = await api.get<ApiResponse<User>>('/auth/me')
        set({ user: response.data.data! })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
