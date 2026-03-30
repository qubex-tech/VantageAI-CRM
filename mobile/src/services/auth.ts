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

export interface ForgotPasswordResponse {
  resetToken: string
  message: string
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const { API_BASE_URL, ENDPOINTS } = await import('@/constants/api')
  const res = await fetch(`${API_BASE_URL}${ENDPOINTS.mobileForgotPassword}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to send reset code')
  return data
}

export async function resetPassword(
  resetToken: string,
  otp: string,
  newPassword: string
): Promise<void> {
  const { API_BASE_URL, ENDPOINTS } = await import('@/constants/api')
  const res = await fetch(`${API_BASE_URL}${ENDPOINTS.mobileResetPassword}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetToken, otp, newPassword }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to reset password')
}
