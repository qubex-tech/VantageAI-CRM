import { create } from 'zustand'
import type { AuthUser } from '@/types'
import { login as loginService, logout as logoutService, getStoredToken } from '@/services/auth'

interface AuthStore {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null

  // Actions
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
    const token = await getStoredToken()
    if (!token) return false
    // Token exists — trust it (JWT expiry is 90 days)
    // We don't store user in SecureStore to avoid stale data; the first API call
    // will 401 if the token is expired and the interceptor clears it.
    set({ token })
    return true
  },

  clearError: () => set({ error: null }),
}))
