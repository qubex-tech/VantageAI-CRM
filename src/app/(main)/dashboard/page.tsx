import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import { isInboundAgentCall } from '@/lib/analytics/voiceConversationInbound'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import { computeInboundTransferMetrics } from '@/lib/analytics/transferMetrics'
import {
  formatRollingRangeLabel,
  resolveRollingDayRangeInTimeZone,
} from '@/lib/analytics/dashboardDateRange'
import {
  countRetellInboundCallsForRange,
  syncMissingRetellInboundCallsForRange,
} from '@/lib/analytics/retellCallSync'
import { getRetellIntegrationConfig } from '@/lib/retell-api'
import { normalizeTimeZone, resolveTimeZone } from '@/lib/timezone'
import type { DashboardMetricsPayload, DashboardPeriodMetrics } from '@/components/dashboard/types'

export const dynamic = 'force-dynamic'

const DEFAULT_PRACTICE_TIMEZONE = 'America/Chicago'

function toSerializableCallRow(row: {
  startedAt: Date
  endedAt: Date | null
  callerPhone: string
  outcome: string | null
  extractedIntent: string | null
  metadata: unknown
}): AnalyticsCallRow {
  return {
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    callerPhone: row.callerPhone,
    outcome: row.outcome,
    extractedIntent: row.extractedIntent,
    metadata: row.metadata
      ? (JSON.parse(JSON.stringify(row.metadata)) as Record<string, unknown>)
      : null,
  }
}

function resolveDashboardDays(searchParams: { days?: string }): 7 | 30 {
  return searchParams.days === '30' ? 30 : 7
}

async function resolveDashboardTimeZone(practiceId: string): Promise<string> {
  const requestHeaders = await headers()
  const fromRequest = await resolveTimeZone(requestHeaders)
  if (fromRequest) return fromRequest

  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: {
      brandProfile: { select: { timezone: true } },
    },
  })

  return (
    normalizeTimeZone(practice?.brandProfile?.timezone) ??
    DEFAULT_PRACTICE_TIMEZONE
  )
}

function buildPeriodMetrics(
  days: 7 | 30,
  timeZone: string,
  rangeStart: Date,
  rangeEnd: Date,
  calls: AnalyticsCallRow[],
  retellCount: number | null
): DashboardPeriodMetrics {
  const inboundCalls = calls.filter((call) => {
    const startedAt = new Date(call.startedAt)
    return startedAt >= rangeStart && startedAt <= rangeEnd
  })
  const { transfersAttempted, transfersSuccessful, transfersUnsuccessful } =
    computeInboundTransferMetrics(inboundCalls)

  const dbCount = inboundCalls.length

  return {
    days,
    rangeLabel: formatRollingRangeLabel(rangeStart, rangeEnd, timeZone),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    callsHandled: retellCount ?? dbCount,
    transfersAttempted,
    transfersSuccessful,
    transfersUnsuccessful,
  }
}

async function loadDashboardMetrics(
  practiceId: string,
  userId: string,
  timeZone: string
): Promise<DashboardMetricsPayload> {
  const range7 = resolveRollingDayRangeInTimeZone(7, timeZone)
  const range30 = resolveRollingDayRangeInTimeZone(30, timeZone)

  let retellCount7: number | null = null
  let retellCount30: number | null = null

  try {
    const integration = await getRetellIntegrationConfig(practiceId)
    await syncMissingRetellInboundCallsForRange({
      practiceId,
      userId,
      agentId: integration.agentId,
      startMs: range30.from.getTime(),
      endMs: range30.to.getTime(),
    })

    ;[retellCount7, retellCount30] = await Promise.all([
      countRetellInboundCallsForRange({
        practiceId,
        agentId: integration.agentId,
        startMs: range7.from.getTime(),
        endMs: range7.to.getTime(),
      }),
      countRetellInboundCallsForRange({
        practiceId,
        agentId: integration.agentId,
        startMs: range30.from.getTime(),
        endMs: range30.to.getTime(),
      }),
    ])
  } catch (error) {
    console.warn('[Dashboard] Retell sync/count failed, falling back to database:', error)
  }

  const callsRaw = await prisma.voiceConversation.findMany({
    where: {
      practiceId,
      startedAt: {
        gte: range30.from,
        lte: range30.to,
      },
    },
    select: {
      startedAt: true,
      endedAt: true,
      outcome: true,
      callerPhone: true,
      extractedIntent: true,
      metadata: true,
    },
    orderBy: {
      startedAt: 'desc',
    },
  })

  const inboundCalls = callsRaw.filter(isInboundAgentCall).map(toSerializableCallRow)

  return {
    timeZone,
    periods: {
      7: buildPeriodMetrics(7, timeZone, range7.from, range7.to, inboundCalls, retellCount7),
      30: buildPeriodMetrics(30, timeZone, range30.from, range30.to, inboundCalls, retellCount30),
    },
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const initialDays = resolveDashboardDays(params)

  const supabaseSession = await getSupabaseSession()

  if (!supabaseSession) {
    redirect('/login')
  }

  const supabaseUser = supabaseSession.user

  let user
  try {
    user = await syncSupabaseUserToPrisma(supabaseUser)
  } catch (error) {
    console.error('[Dashboard] Error syncing user to Prisma:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const safeErrorMessage =
      errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
  }

  if (!user) {
    redirect('/login?error=User account not found.')
  }

  if (!user.practiceId) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
        <DashboardPageHeader
          userName={user.name || 'User'}
          rangeLabel="Practice analytics unavailable"
        />
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-lg shadow-gray-200/50">
          <p className="text-sm text-gray-600">
            As a Vantage Admin, you can manage practices from the Settings page.
          </p>
        </div>
      </div>
    )
  }

  const timeZone = await resolveDashboardTimeZone(user.practiceId)
  const metrics = await loadDashboardMetrics(user.practiceId, user.id, timeZone)

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6 min-w-0 max-w-full">
      <Suspense fallback={null}>
        <DashboardView
          userName={user.name || user.email || 'User'}
          metrics={metrics}
          initialDays={initialDays}
        />
      </Suspense>
    </div>
  )
}
