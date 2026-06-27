import axios, { AxiosInstance, AxiosRequestConfig, isAxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL } from '@/constants/api'

export const TOKEN_KEY = 'vantage_mobile_token'
export const USER_KEY = 'auth_user'

let instance: AxiosInstance | null = null
let unauthorizedHandler: (() => void | Promise<void>) | null = null

export function setUnauthorizedHandler(handler: () => void | Promise<void>): void {
  unauthorizedHandler = handler
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const raw = err.response?.data?.error
    const message =
      (typeof raw === 'string' ? raw : raw?.message)
      ?? err.message
      ?? fallback
    return message
  }
  if (err instanceof Error) return err.message
  return fallback
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ])
}

export function getApiClient(): AxiosInstance {
  if (instance) return instance

  instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })

  instance.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    if (token) {
      config.headers = config.headers ?? {}
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  })

  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      if (err.response?.status === 401) {
        await clearStoredSession()
        await unauthorizedHandler?.()
      }
      return Promise.reject(err)
    }
  )

  return instance
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const client = getApiClient()
  const res = await client.get<T>(url, { params })
  return res.data
}

export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const client = getApiClient()
  const res = await client.post<T>(url, data, config)
  return res.data
}

export async function apiDelete<T>(url: string, data?: unknown): Promise<T> {
  const client = getApiClient()
  const res = await client.delete<T>(url, { data })
  return res.data
}
