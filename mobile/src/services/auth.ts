import * as SecureStore from 'expo-secure-store'
import { apiPost, getApiErrorMessage, TOKEN_KEY, USER_KEY } from './apiClient'
import { ENDPOINTS } from '@/constants/api'
import { decodeJwtPayload, isJwtExpired } from '@/lib/jwt'
import type { AuthUser } from '@/types'

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
  await clearStoredCredentials()
}

export async function clearStoredCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ])
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY)
    if (raw) return JSON.parse(raw) as AuthUser

    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    if (!token) return null

    const payload = decodeJwtPayload(token)
    if (!payload) return null

    const user: AuthUser = {
      id: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      name: payload.name != null ? String(payload.name) : null,
      practiceId: payload.practiceId != null ? String(payload.practiceId) : null,
      practiceName: payload.practiceName != null ? String(payload.practiceName) : null,
      role: String(payload.role ?? 'user'),
    }

    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
    return user
  } catch {
    return null
  }
}

export async function isStoredSessionValid(): Promise<boolean> {
  const token = await getStoredToken()
  if (!token) return false
  return !isJwtExpired(token)
}

export interface ForgotPasswordResponse {
  resetToken: string
  message: string
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  try {
    return await apiPost<ForgotPasswordResponse>(ENDPOINTS.mobileForgotPassword, { email })
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Failed to send reset code'))
  }
}

export async function resetPassword(
  resetToken: string,
  otp: string,
  newPassword: string
): Promise<void> {
  try {
    await apiPost(ENDPOINTS.mobileResetPassword, { resetToken, otp, newPassword })
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Failed to reset password'))
  }
}

export interface EmailOtpResponse {
  loginToken: string
  message: string
}

export async function sendEmailOtp(email: string): Promise<EmailOtpResponse> {
  try {
    return await apiPost<EmailOtpResponse>(ENDPOINTS.mobileEmailOtp, { email })
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Failed to send sign-in code'))
  }
}

export interface EmailOtpVerifyResponse {
  token: string
  user: AuthUser
}

export async function verifyEmailOtp(loginToken: string, otp: string): Promise<EmailOtpVerifyResponse> {
  try {
    return await apiPost<EmailOtpVerifyResponse>(ENDPOINTS.mobileEmailOtpVerify, { loginToken, otp })
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Invalid code'))
  }
}

export async function storeSession(token: string, user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
}
