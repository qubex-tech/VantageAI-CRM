// The base URL of the VantageAI CRM backend.
// In development this points to localhost. For production builds, replace with
// the deployed URL (e.g. https://app.vantageai.com).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export const ENDPOINTS = {
  // Mobile-specific
  mobileAuth: '/api/mobile/auth',
  pushTokens: '/api/mobile/push-tokens',
  mobileNotifications: '/api/mobile/notifications',

  // Shared with web CRM (existing endpoints)
  conversations: '/api/conversations',
  conversationById: (id: string) => `/api/conversations/${id}`,
  conversationMessages: (id: string) => `/api/conversations/${id}/messages`,
  unreadCount: '/api/conversations/unread-count',
  sendMessage: '/api/messages/send',

  // Calls
  mobileCalls: '/api/mobile/calls',
  mobileCallById: (id: string) => `/api/mobile/calls/${id}`,
  mobileCallReview: (id: string) => `/api/mobile/calls/${id}/review`,
} as const
