import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getUserTokens, sendExpoPushNotifications } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

/**
 * POST /api/mobile/push-tokens/test
 * Sends a test push notification to the authenticated user's registered devices.
 * Used to verify end-to-end push notification delivery.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const tokens = await getUserTokens([user.id])

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'No registered devices found for this user. Open the app on your phone first.' },
        { status: 404 }
      )
    }

    await sendExpoPushNotifications(tokens, {
      title: '🔔 Test Notification',
      body: 'Push notifications are working correctly!',
      data: { type: 'test' },
    })

    return NextResponse.json({ success: true, tokenCount: tokens.length })
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[push-tokens/test]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
