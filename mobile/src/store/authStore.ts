import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { AuthUser } from '@/types'
import {
  login as loginService,
  clearStoredCredentials,
  getStoredToken,
  getStoredUser,
  isStoredSessionValid,
} from '@/services/auth'
import { getApiErrorMessage, USER_KEY } from '@/services/apiClient'
import { deregisterPushNotifications } from '@/services/notifications'

interface AuthStore {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  forceLogout: () => Promise<void>
  restoreSession: () => Promise<boolean>
  setAriaScribeEnabled: (enabled: boolean) => void
  clearError: () => void
}

async function clearSessionState(): Promise<void> {
  await deregisterPushNotifications().catch(() => null)
  await clearStoredCredentials()
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
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Login failed. Please try again.')
      set({ error: message, isLoading: false })
      throw err
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await clearSessionState()
    } finally {
      set({ user: null, token: null, isLoading: false, error: null })
    }
  },

  forceLogout: async () => {
    await clearSessionState()
    set({ user: null, token: null, isLoading: false, error: null })
  },

  restoreSession: async () => {
    const valid = await isStoredSessionValid()
    if (!valid) {
      await clearStoredCredentials()
      set({ user: null, token: null })
      return false
    }

    const [token, user] = await Promise.all([getStoredToken(), getStoredUser()])
    if (!token) {
      set({ user: null, token: null })
      return false
    }

    set({ token, user })
    return true
  },

  setAriaScribeEnabled: (enabled) =>
    set((state) => {
      if (!state.user) return state
      const user = { ...state.user, ariaScribeEnabled: enabled }
      void SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => null)
      return { user }
    }),

  clearError: () => set({ error: null }),
}))
