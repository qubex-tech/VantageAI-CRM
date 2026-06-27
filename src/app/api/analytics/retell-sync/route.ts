import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/middleware'
import { getRetellIntegrationConfig } from '@/lib/retell-api'
import { resolveCallDateRangeUtc } from '@/lib/analytics/callDateRangeUtc'
import { syncRetellInboundCallsForRange } from '@/lib/analytics/retellCallSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const bodySchema = z.object({
  callFrom: z.string().optional(),
  callTo: z.string().optional(),
})

/**
 * POST /api/analytics/retell-sync
 * Re-fetch inbound calls from Retell for the analytics date window and merge into voice_conversations.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice is required' }, { status: 400 })
    }

    let json: unknown = {}
    try {
      json = await req.json()
    } catch {
      json = {}
    }
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { from, to } = resolveCallDateRangeUtc(parsed.data)
    const startMs = from.getTime()
    const endMs = to.getTime()

    // Validate the integration exists/active before syncing (throws if not configured).
    await getRetellIntegrationConfig(user.practiceId)

    // Sync inbound calls for the whole practice (every agent on the account), not a
    // single configured agentId — agents get swapped/upgraded over time and analytics
    // are associated to the practice, not to a specific agent version.
    const result = await syncRetellInboundCallsForRange({
      practiceId: user.practiceId,
      userId: user.id,
      agentId: null,
      startMs,
      endMs,
    })

    return NextResponse.json({
      ok: true,
      startMs,
      endMs,
      agentId: null,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    const status = message.includes('not configured') ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
