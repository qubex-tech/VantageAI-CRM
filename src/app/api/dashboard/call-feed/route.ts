import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { CALL_FEED_PAGE_SIZE } from '@/lib/dashboard/callFeed'
import { loadCallFeedPage } from '@/lib/dashboard/loadCallFeedPage'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/call-feed
 * Paginated inbound AI front-desk calls for the dashboard activity feed.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice is required' }, { status: 400 })
    }

    const params = req.nextUrl.searchParams
    const cursor = params.get('cursor')
    const limitRaw = params.get('limit')
    const limit = limitRaw ? Number(limitRaw) : CALL_FEED_PAGE_SIZE
    if (!Number.isFinite(limit) || limit < 1) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 })
    }

    const page = await loadCallFeedPage({
      practiceId: user.practiceId,
      cursor,
      limit,
    })

    return NextResponse.json(page)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Feed failed'
    if (message === 'Invalid cursor') {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
