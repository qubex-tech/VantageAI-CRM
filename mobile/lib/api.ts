import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

// Use environment variable or fall back to localhost for development
const BASE_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:3000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Bearer token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token')
      await SecureStore.deleteItemAsync('auth_user')
    }
    return Promise.reject(error)
  }
)

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string; name: string | null; practiceId: string | null; role: string } }>(
      '/api/mobile/auth/login',
      { email, password }
    ),
  me: () =>
    api.get<{ user: { id: string; email: string; name: string | null; practiceId: string | null; role: string } }>(
      '/api/mobile/auth/me'
    ),
}

// ─── Patients ────────────────────────────────────────────────────────────────
export const patientsApi = {
  list: (params?: { search?: string; limit?: number }) =>
    api.get('/api/patients', { params }),
  get: (id: string) =>
    api.get(`/api/patients/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/api/patients', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/patients/${id}`, data),
  timeline: (id: string) =>
    api.get(`/api/patients/${id}/timeline`),
  notes: (id: string) =>
    api.get(`/api/patients/${id}/notes`),
  addNote: (id: string, content: string) =>
    api.post(`/api/patients/${id}/notes`, { content }),
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export const appointmentsApi = {
  list: (params?: { status?: string; patientId?: string; limit?: number; from?: string; to?: string }) =>
    api.get('/api/appointments', { params }),
  get: (id: string) =>
    api.get(`/api/appointments/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/appointments/${id}`, data),
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: { assignedTo?: string; status?: string; priority?: string; patientId?: string; dueDate?: string; search?: string; limit?: number }) =>
    api.get('/api/tasks', { params }),
  get: (id: string) =>
    api.get(`/api/tasks/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/api/tasks', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/tasks/${id}`, data),
  comments: (id: string) =>
    api.get(`/api/tasks/${id}/comments`),
  addComment: (id: string, content: string) =>
    api.post(`/api/tasks/${id}/comments`, { content }),
}

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: (params?: { status?: string; channel?: string; search?: string; limit?: number }) =>
    api.get('/api/conversations', { params }),
  get: (id: string) =>
    api.get(`/api/conversations/${id}`),
  messages: (id: string) =>
    api.get(`/api/conversations/${id}/messages`),
  sendMessage: (id: string, data: { content: string; channel: string }) =>
    api.post(`/api/conversations/${id}/messages`, data),
  unreadCount: () =>
    api.get('/api/conversations/unread-count'),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () =>
    api.get('/api/dashboard/stats'),
}
