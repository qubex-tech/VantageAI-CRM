import * as SecureStore from 'expo-secure-store'
import { apiPost } from './apiClient'
import { TOKEN_KEY } from './apiClient'
import { ENDPOINTS } from '@/constants/api'
import type { AuthUser } from '@/types'

interface LoginResponse {
  token: string
  user: AuthUser
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await apiPost<LoginResponse>(ENDPOINTS.mobileAuth, { email, password })
  await SecureStore.setItemAsync(TOKEN_KEY, response.token)
  return response.user
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}
