import { create } from 'zustand'
import type { AuthUser } from '@/types'
import { login as loginService, logout as logoutService, getStoredToken, getStoredUser } from '@/services/auth'

interface AuthStore {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<boolean>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const user = await loginService(email, password)
      const token = await getStoredToken()
      set({ user, token, isLoading: false })
    } catch (err: any) {
      const raw = err?.response?.data?.error
      const message =
        (typeof raw === 'string' ? raw : raw?.message)
        ?? err?.message
        ?? 'Login failed. Please try again.'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await logoutService()
    } finally {
      set({ user: null, token: null, isLoading: false })
    }
  },

  restoreSession: async () => {
    const [token, user] = await Promise.all([getStoredToken(), getStoredUser()])
    if (!token) return false
    set({ token, user })
    return true
  },

  clearError: () => set({ error: null }),
}))
