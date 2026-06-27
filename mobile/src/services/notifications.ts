import { apiGet, apiPost, apiDelete } from './apiClient'
import { ENDPOINTS } from '@/constants/api'
import type { MobileNotification, NotificationsResponse } from '@/types'

export interface NotificationFilters {
  limit?: number
  cursor?: string
  unreadOnly?: boolean
}

export async function fetchNotifications(filters: NotificationFilters = {}): Promise<NotificationsResponse> {
  const params: Record<string, unknown> = {}
  if (filters.limit) params.limit = filters.limit
  if (filters.cursor) params.cursor = filters.cursor
  if (filters.unreadOnly != null) params.unreadOnly = String(filters.unreadOnly)

  return apiGet<NotificationsResponse>(ENDPOINTS.mobileNotifications, params)
}

export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android',
  appVersion?: string
): Promise<void> {
  await apiPost(ENDPOINTS.pushTokens, { token, platform, appVersion })
}

export async function unregisterPushToken(token: string): Promise<void> {
  await apiDelete(ENDPOINTS.pushTokens, { token })
}

import { supportsRemotePushNotifications } from '@/lib/expo-environment'

export async function deregisterPushNotifications(): Promise<void> {
  if (!supportsRemotePushNotifications()) return
  try {
    const Notifications = await import('expo-notifications')
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null)
    if (tokenData?.data) {
      await unregisterPushToken(tokenData.data).catch(() => null)
    }
  } catch {
    // no-op
  }
}
