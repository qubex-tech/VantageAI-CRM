import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    if (!user.practiceId) {
      return NextResponse.json({ calls: [], reviewedCallIds: [] })
    }

    const { getRetellClient, getRetellIntegrationConfig } = await import('@/lib/retell-api')

    // Load integration to get the configured agentId for filtering
    let retell: any = null
    let agentId: string | null = null
    try {
      const config = await getRetellIntegrationConfig(user.practiceId)
      agentId = config.agentId ?? null
      retell = await getRetellClient(user.practiceId)
    } catch (e: any) {
      console.log('[mobile/calls] No Retell integration:', e?.message)
      return NextResponse.json({ calls: [], reviewedCallIds: [], debug: e?.message })
    }

    // Fetch reviewed call IDs for this practice
    const reviews = await prisma.callReview.findMany({
      where: { practiceId: user.practiceId },
      select: { callId: true },
    })
    const reviewedCallIds = reviews.map((r) => r.callId)

    // Fetch a larger batch so we can sort + slice for the right window.
    // Retell doesn't reliably honour sort_order so we over-fetch and sort server-side.
    let calls: any[] = []
    try {
      // Fetch more than needed so sorting gives us the true newest records
      const fetchLimit = Math.min(limit * 4, 200)
      const result = await retell.listCalls({ limit: fetchLimit, agentId: agentId ?? undefined })
      const raw: any[] = result?.calls ?? []

      // Sort newest-first by start_timestamp (milliseconds epoch).
      // This is the definitive client-side sort so the list is always newest at top
      // regardless of what Retell returns.
      raw.sort((a, b) => {
        const aTs = a.start_timestamp ?? a.startTimestamp ?? 0
        const bTs = b.start_timestamp ?? b.startTimestamp ?? 0
        return bTs - aTs
      })

      // Slice to the requested window
      calls = raw.slice(offset, offset + limit)

      console.log(
        `[mobile/calls] fetched ${raw.length} calls, returning ${calls.length} ` +
        `(offset=${offset}, limit=${limit}, agentId=${agentId ?? 'all'}) ` +
        `newest=${calls[0]?.start_timestamp ?? 'n/a'}`
      )
    } catch (e: any) {
      console.error('[mobile/calls] listCalls failed:', e?.message)
      return NextResponse.json({ calls: [], reviewedCallIds: [], debug: `listCalls error: ${e?.message}` })
    }

    return NextResponse.json({ calls, reviewedCallIds })
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/calls GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
