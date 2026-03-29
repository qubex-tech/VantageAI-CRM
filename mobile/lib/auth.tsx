import React, { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { useRouter, useSegments } from 'expo-router'
import { authApi } from './api'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
  })
  const router = useRouter()
  const segments = useSegments()

  // On mount, restore session from SecureStore
  useEffect(() => {
    async function loadSession() {
      try {
        const token = await SecureStore.getItemAsync('auth_token')
        const userJson = await SecureStore.getItemAsync('auth_user')
        if (token && userJson) {
          const user: User = JSON.parse(userJson)
          setState({ user, token, isLoading: false })
        } else {
          setState({ user: null, token: null, isLoading: false })
        }
      } catch {
        setState({ user: null, token: null, isLoading: false })
      }
    }
    loadSession()
  }, [])

  // Navigation guard
  useEffect(() => {
    if (state.isLoading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!state.user && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (state.user && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [state.user, state.isLoading, segments])

  async function signIn(email: string, password: string) {
    const { data } = await authApi.login(email, password)
    await SecureStore.setItemAsync('auth_token', data.token)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(data.user))
    setState({ user: data.user as User, token: data.token, isLoading: false })
  }

  async function signOut() {
    await SecureStore.deleteItemAsync('auth_token')
    await SecureStore.deleteItemAsync('auth_user')
    setState({ user: null, token: null, isLoading: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
