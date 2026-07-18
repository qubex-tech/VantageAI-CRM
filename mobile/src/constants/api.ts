import { getApiBaseUrl } from '@/lib/config'

export const API_BASE_URL = getApiBaseUrl()

export const ENDPOINTS = {
  // Auth
  mobileAuth: '/api/mobile/auth',
  mobileEmailOtp: '/api/mobile/auth/email-otp',
  mobileEmailOtpVerify: '/api/mobile/auth/email-otp/verify',
  mobileForgotPassword: '/api/mobile/forgot-password',
  mobileResetPassword: '/api/mobile/reset-password',

  // Notifications & push
  pushTokens: '/api/mobile/push-tokens',
  pushTokensTest: '/api/mobile/push-tokens/test',
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

  // Features / Aria
  mobileFeatures: '/api/mobile/features',
  ariaSchedule: '/api/mobile/scribe/schedule',
  ariaSessions: '/api/mobile/scribe/sessions',
  ariaSessionById: (id: string) => `/api/mobile/scribe/sessions/${id}`,
  ariaSessionChunks: (id: string) => `/api/mobile/scribe/sessions/${id}/chunks`,
  ariaSessionStop: (id: string) => `/api/mobile/scribe/sessions/${id}/stop`,
  ariaSessionNote: (id: string) => `/api/mobile/scribe/sessions/${id}/note`,
  ariaSessionSign: (id: string) => `/api/mobile/scribe/sessions/${id}/sign`,
  ariaSessionDiscard: (id: string) => `/api/mobile/scribe/sessions/${id}/discard`,
} as const
