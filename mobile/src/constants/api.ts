export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export const ENDPOINTS = {
  // Auth
  mobileAuth: '/api/mobile/auth',
  mobileEmailOtp: '/api/mobile/auth/email-otp',
  mobileEmailOtpVerify: '/api/mobile/auth/email-otp/verify',
  mobileForgotPassword: '/api/mobile/forgot-password',
  mobileResetPassword: '/api/mobile/reset-password',

  // Notifications & push
  pushTokens: '/api/mobile/push-tokens',
  mobileNotifications: '/api/mobile/notifications',

  // Inbox
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
