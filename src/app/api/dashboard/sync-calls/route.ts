import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellIntegrationConfig } from '@/lib/retell-api'
import { resolveDashboardRangeInTimeZone } from '@/lib/analytics/dashboardDateRange'
import { syncMissingRetellInboundCallsForRange } from '@/lib/analytics/retellCallSync'
import { prisma } from '@/lib/db'
import { normalizeTimeZone } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEFAULT_PRACTICE_TIMEZONE = 'America/Chicago'

/**
 * POST /api/dashboard/sync-calls
 * Imports missing inbound Retell calls for the dashboard window without blocking page render.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice is required' }, { status: 400 })
    }

    const practice = await prisma.practice.findUnique({
      where: { id: user.practiceId },
      select: {
        brandProfile: { select: { timezone: true } },
      },
    })

    const timeZone =
      normalizeTimeZone(practice?.brandProfile?.timezone) ?? DEFAULT_PRACTICE_TIMEZONE
    const range30 = resolveDashboardRangeInTimeZone(30, timeZone)
    // Validate the integration exists/active before syncing (throws if not configured).
    await getRetellIntegrationConfig(user.practiceId)

    // Backfill inbound calls from every agent on the account (agentId: null), matching
    // the dashboard's all-agent handled count so backfill never misses a practice's
    // primary inbound agent.
    const result = await syncMissingRetellInboundCallsForRange({
      practiceId: user.practiceId,
      userId: user.id,
      agentId: null,
      startMs: range30.startMs,
      endMs: range30.endMs,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    const status = message.includes('not configured') ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
