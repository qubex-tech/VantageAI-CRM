import * as SecureStore from 'expo-secure-store'
import { apiPost } from './apiClient'
import { TOKEN_KEY } from './apiClient'
import { ENDPOINTS } from '@/constants/api'
import type { AuthUser } from '@/types'

const USER_KEY = 'auth_user'

interface LoginResponse {
  token: string
  user: AuthUser
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await apiPost<LoginResponse>(ENDPOINTS.mobileAuth, { email, password })
  await SecureStore.setItemAsync(TOKEN_KEY, response.token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user))
  return response.user
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(USER_KEY)
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

/** Decode JWT payload without verifying signature (client-side, for display only). */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    // Try the persisted user object first
    const raw = await SecureStore.getItemAsync(USER_KEY)
    if (raw) return JSON.parse(raw)

    // Fallback: decode from the JWT payload (handles sessions from before user persistence)
    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    if (!token) return null

    const payload = decodeJwtPayload(token)
    if (!payload) return null

    const user: AuthUser = {
      id: payload.sub ?? '',
      email: payload.email ?? '',
      name: payload.name ?? null,
      practiceId: payload.practiceId ?? null,
      practiceName: payload.practiceName ?? null,
      role: payload.role ?? 'user',
    }

    // Persist it so next cold-start skips the decode
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
    return user
  } catch {
    return null
  }
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
