import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellIntegrationConfig } from '@/lib/retell-api'
import { resolveRetellRollingRange } from '@/lib/analytics/dashboardDateRange'
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
    const range30 = resolveRetellRollingRange(30)
    const integration = await getRetellIntegrationConfig(user.practiceId)

    const result = await syncMissingRetellInboundCallsForRange({
      practiceId: user.practiceId,
      userId: user.id,
      agentId: integration.agentId,
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
