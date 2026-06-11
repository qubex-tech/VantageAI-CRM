import { redirect } from 'next/navigation'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { HealixCommandCenter } from '@/components/healix/HealixCommandCenter'
import { DashboardFrontDeskMetrics } from '@/components/dashboard/DashboardFrontDeskMetrics'
import { isInboundAgentCall } from '@/lib/analytics/voiceConversationInbound'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import { computeInboundTransferMetrics } from '@/lib/analytics/transferMetrics'

export const dynamic = 'force-dynamic'

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
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3 pb-24 md:pb-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user.name || 'User'}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-lg shadow-gray-200/50">
          <p className="text-sm text-gray-600">
            As a Vantage Admin, you can manage practices from the Settings page.
          </p>
        </div>
      </div>
    )
  }

  const practiceId = user.practiceId
  const now = new Date()
  const rangeStart = startOfDay(subDays(now, days - 1))
  const rangeEnd = endOfDay(now)

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
  const callsHandled = inboundCallsRaw.length
  const { transfersAttempted, transfersSuccessful, transfersUnsuccessful } =
    computeInboundTransferMetrics(inboundCalls)

  const healixContext = {
    route: '/dashboard',
    screenTitle: 'Dashboard',
    dashboardContext: {
      windowStart: rangeStart.toISOString(),
      windowEnd: rangeEnd.toISOString(),
      frontDeskMetrics: {
        days,
        callsHandled,
        transfersAttempted,
        transfersSuccessful,
        transfersUnsuccessful,
      },
    },
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3 pb-24 md:pb-6 min-w-0 max-w-full">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back, {user.name || user.email || 'User'}</p>
      </div>

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
        rangeStart={rangeStart.toISOString()}
        rangeEnd={rangeEnd.toISOString()}
        callsHandled={callsHandled}
        transfersSuccessful={transfersSuccessful}
        transfersUnsuccessful={transfersUnsuccessful}
        transfersAttempted={transfersAttempted}
      />
    </div>
  )
}
