import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { DashboardBackgroundSync } from '@/components/dashboard/DashboardBackgroundSync'
import { isInboundAgentCall } from '@/lib/analytics/voiceConversationInbound'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import { computeInboundTransferMetrics } from '@/lib/analytics/transferMetrics'
import {
  formatDashboardRangeLabel,
  resolveDashboardRangeInTimeZone,
} from '@/lib/analytics/dashboardDateRange'
import { countRetellCallsForDashboardRange } from '@/lib/analytics/retellCallSync'
import { normalizeTimeZone, resolveTimeZone } from '@/lib/timezone'
import type { DashboardMetricsPayload, DashboardPeriodMetrics } from '@/components/dashboard/types'

export { DashboardMetricsSkeleton } from '@/components/dashboard/DashboardMetricsSkeleton'

const DEFAULT_PRACTICE_TIMEZONE = 'America/Chicago'

function toSerializableCallRow(row: {
  startedAt: Date
  outcome: string | null
  metadata: unknown
}): AnalyticsCallRow {
  return {
    startedAt: row.startedAt.toISOString(),
    endedAt: null,
    callerPhone: '',
    outcome: row.outcome,
    extractedIntent: null,
    metadata: row.metadata
      ? (JSON.parse(JSON.stringify(row.metadata)) as Record<string, unknown>)
      : null,
  }
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
  retellCallsHandled: number | null
): DashboardPeriodMetrics {
  const inboundCalls = calls.filter((call) => {
    const startedAt = new Date(call.startedAt)
    return startedAt >= rangeStart && startedAt <= rangeEnd
  })
  const { transfersAttempted, transfersSuccessful, transfersUnsuccessful } =
    computeInboundTransferMetrics(inboundCalls)

  return {
    days,
    rangeLabel: formatDashboardRangeLabel(days, rangeStart, rangeEnd, timeZone),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    callsHandled: retellCallsHandled ?? inboundCalls.length,
    transfersAttempted,
    transfersSuccessful,
    transfersUnsuccessful,
  }
}

async function loadDashboardMetrics(
  practiceId: string,
  timeZone: string
): Promise<DashboardMetricsPayload> {
  const now = new Date()
  const range7 = resolveDashboardRangeInTimeZone(7, timeZone, now)
  const range30 = resolveDashboardRangeInTimeZone(30, timeZone, now)

  let retellCount7: number | null = null
  let retellCount30: number | null = null

  try {
    ;[retellCount7, retellCount30] = await Promise.all([
      countRetellCallsForDashboardRange({
        practiceId,
        startMs: range7.startMs,
        endMs: range7.endMs,
      }),
      countRetellCallsForDashboardRange({
        practiceId,
        startMs: range30.startMs,
        endMs: range30.endMs,
      }),
    ])
  } catch (error) {
    console.warn('[Dashboard] Retell call count failed, falling back to database:', error)
  }

  const callsRaw = await prisma.voiceConversation.findMany({
    where: {
      practiceId,
      startedAt: {
        gte: range30.from,
        lte: range30.to,
      },
      NOT: {
        outcome: 'outbound_insurance_verification_initiated',
      },
    },
    select: {
      startedAt: true,
      outcome: true,
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
      7: buildPeriodMetrics(
        7,
        timeZone,
        range7.from,
        range7.to,
        inboundCalls,
        retellCount7
      ),
      30: buildPeriodMetrics(
        30,
        timeZone,
        range30.from,
        range30.to,
        inboundCalls,
        retellCount30
      ),
    },
  }
}

export async function DashboardMetricsSection({
  practiceId,
  userName,
  initialDays,
}: {
  practiceId: string
  userId: string
  userName: string
  initialDays: 7 | 30
}) {
  const timeZone = await resolveDashboardTimeZone(practiceId)
  const metrics = await loadDashboardMetrics(practiceId, timeZone)

  return (
    <>
      <DashboardBackgroundSync />
      <DashboardView userName={userName} metrics={metrics} initialDays={initialDays} />
    </>
  )
}
