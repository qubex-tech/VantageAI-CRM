import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { HealixCommandCenter } from '@/components/healix/HealixCommandCenter'
import { DashboardFrontDeskMetrics } from '@/components/dashboard/DashboardFrontDeskMetrics'
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const days = resolveDashboardDays(params)

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
          days={days}
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

  const practiceId = user.practiceId
  const timeZone = await resolveDashboardTimeZone(practiceId)
  const { from: rangeStart, to: rangeEnd } = resolveRollingDayRangeInTimeZone(days, timeZone)
  const rangeLabel = formatRollingRangeLabel(rangeStart, rangeEnd, timeZone)
  const startMs = rangeStart.getTime()
  const endMs = rangeEnd.getTime()

  let callsHandled: number | null = null

  try {
    const integration = await getRetellIntegrationConfig(practiceId)
    await syncMissingRetellInboundCallsForRange({
      practiceId,
      userId: user.id,
      agentId: integration.agentId,
      startMs,
      endMs,
    })
    callsHandled = await countRetellInboundCallsForRange({
      practiceId,
      agentId: integration.agentId,
      startMs,
      endMs,
    })
  } catch (error) {
    console.warn('[Dashboard] Retell sync/count failed, falling back to database:', error)
  }

  const calls = await prisma.voiceConversation.findMany({
    where: {
      practiceId,
      startedAt: {
        gte: rangeStart,
        lte: rangeEnd,
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

  const inboundCallsRaw = calls.filter(isInboundAgentCall)
  const inboundCalls = inboundCallsRaw.map(toSerializableCallRow)

  if (callsHandled === null) {
    callsHandled = inboundCallsRaw.length
  }

  const { transfersAttempted, transfersSuccessful, transfersUnsuccessful } =
    computeInboundTransferMetrics(inboundCalls)

  const healixContext = {
    route: '/dashboard',
    screenTitle: 'Dashboard',
    timeZone,
    dashboardContext: {
      windowStart: rangeStart.toISOString(),
      windowEnd: rangeEnd.toISOString(),
      frontDeskMetrics: {
        days,
        timeZone,
        callsHandled,
        transfersAttempted,
        transfersSuccessful,
        transfersUnsuccessful,
      },
    },
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6 min-w-0 max-w-full">
      <DashboardPageHeader
        userName={user.name || user.email || 'User'}
        days={days}
        rangeLabel={rangeLabel}
      />

      <div className="mb-6">
        <HealixCommandCenter
          context={healixContext}
          frontDeskStats={{
            callsHandled,
            transfersSuccessful,
            transfersUnsuccessful,
            transfersAttempted,
            days,
          }}
        />
      </div>

      <DashboardFrontDeskMetrics
        days={days}
        callsHandled={callsHandled}
        transfersSuccessful={transfersSuccessful}
        transfersUnsuccessful={transfersUnsuccessful}
        transfersAttempted={transfersAttempted}
      />
    </div>
  )
}
