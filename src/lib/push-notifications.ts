/**
 * Server-side Expo Push Notification sender
 * Sends push notifications to mobile devices via Expo's push service.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
import { prisma } from './db'

interface PushMessage {
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
  /** Android notification channel (must match app.json channels) */
  channelId?: string
}

/** Send Expo push notifications to a list of device tokens (batched at 100). */
export async function sendExpoPushNotifications(
  tokens: string[],
  message: PushMessage
): Promise<void> {
  if (tokens.length === 0) return

  const messages = tokens.map((token) => ({
    to: token,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    sound: message.sound ?? 'default',
    ...(message.badge !== undefined && { badge: message.badge }),
    channelId: message.channelId ?? 'default',
  }))

  // Expo push API accepts batches of up to 100
  const BATCH_SIZE = 100
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[push] Expo push API error:', res.status, text)
      } else {
        const result = await res.json().catch(() => null)
        const errors = result?.data?.filter((r: any) => r.status === 'error') ?? []
        if (errors.length > 0) {
          console.warn('[push] Some tokens returned errors:', errors.length, errors[0])
        }
      }
    } catch (err) {
      console.error('[push] Failed to send push batch:', err)
    }
  }
}

/** Return all push tokens for every active user in a practice. */
export async function getPracticeTokens(practiceId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { practiceId },
    select: { id: true },
  })
  if (users.length === 0) return []

  const tokens = await prisma.devicePushToken.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    select: { token: true },
  })
  return tokens.map((t) => t.token)
}

/** Return push tokens for a specific set of user IDs. */
export async function getUserTokens(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return []
  const tokens = await prisma.devicePushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  })
  return tokens.map((t) => t.token)
}

/**
 * Send a push notification to all users in a practice.
 * Errors are caught and logged — never throws.
 */
export async function notifyPractice(
  practiceId: string,
  message: PushMessage
): Promise<void> {
  try {
    const tokens = await getPracticeTokens(practiceId)
    if (tokens.length === 0) return
    console.log(`[push] notifyPractice: ${tokens.length} tokens for practice ${practiceId}`)
    await sendExpoPushNotifications(tokens, message)
  } catch (err) {
    console.error('[push] notifyPractice failed:', err)
  }
}

/**
 * Send a push notification to specific users.
 * Errors are caught and logged — never throws.
 */
export async function notifyUsers(
  userIds: string[],
  message: PushMessage
): Promise<void> {
  try {
    const tokens = await getUserTokens(userIds)
    if (tokens.length === 0) return
    console.log(`[push] notifyUsers: ${tokens.length} tokens for ${userIds.length} users`)
    await sendExpoPushNotifications(tokens, message)
  } catch (err) {
    console.error('[push] notifyUsers failed:', err)
  }
}
