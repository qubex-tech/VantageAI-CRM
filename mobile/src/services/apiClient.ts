import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL } from '@/constants/api'

export const TOKEN_KEY = 'vantage_mobile_token'

let instance: AxiosInstance | null = null

export function getApiClient(): AxiosInstance {
  if (instance) return instance

  instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })

  // Attach Bearer token from SecureStore on every request
  instance.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    if (token) {
      config.headers = config.headers ?? {}
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  })

  // On 401, clear stored token so the app navigates to login
  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      if (err.response?.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY)
        // Consumers can listen for this to navigate to login
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
