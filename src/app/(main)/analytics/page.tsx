import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { addDays, endOfDay, format, startOfDay, subDays } from 'date-fns'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs'
import { isInboundAgentCall } from '@/lib/analytics/voiceConversationInbound'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import { last7DaysStartUtc, resolveCallDateRangeUtc } from '@/lib/analytics/callDateRangeUtc'

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

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ callFrom?: string; callTo?: string }>
}) {
  const params = await searchParams
  const supabaseSession = await getSupabaseSession()

  if (!supabaseSession) {
    redirect('/login')
  }

  const supabaseUser = supabaseSession.user
  let user
  try {
    user = await syncSupabaseUserToPrisma(supabaseUser)
  } catch (error) {
    console.error('Error syncing user to Prisma:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const safeErrorMessage =
      errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage
    redirect(
      `/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`
    )
  }

  if (!user) {
    redirect('/login?error=User account not found.')
  }

  if (!user.practiceId) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Practice analytics are not available for this account.</p>
        </div>
      </div>
    )
  }

  const practiceId = user.practiceId
  const now = new Date()
  const { from: callRangeStart, to: callRangeEnd } = resolveCallDateRangeUtc(params, now)

  const schedulingRangeStart = subDays(startOfDay(now), 30)
  const schedulingRangeEnd = endOfDay(now)
  const last7Start = last7DaysStartUtc(now)
  const upcomingEnd = addDays(endOfDay(now), 7)

  const [calls, appointments, upcomingAppointments] = await Promise.all([
    prisma.voiceConversation.findMany({
      where: {
        practiceId,
        startedAt: {
          gte: callRangeStart,
          lte: callRangeEnd,
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
    }),
    prisma.appointment.findMany({
      where: {
        practiceId,
        startTime: {
          gte: schedulingRangeStart,
          lte: schedulingRangeEnd,
        },
      },
      select: {
        status: true,
        visitType: true,
        startTime: true,
        createdAt: true,
      },
      orderBy: {
        startTime: 'desc',
      },
    }),
    prisma.appointment.count({
      where: {
        practiceId,
        startTime: {
          gte: startOfDay(now),
          lte: upcomingEnd,
        },
        status: {
          not: 'cancelled',
        },
      },
    }),
  ])

  const inboundCallsRaw = calls.filter(isInboundAgentCall)
  const inboundCalls = inboundCallsRaw.map(toSerializableCallRow)

  const completedInbound = inboundCallsRaw.filter((call) => call.endedAt)
  const totalCallSeconds = completedInbound.reduce((total, call) => {
    if (!call.endedAt) {
      return total
    }
    return total + Math.max(0, call.endedAt.getTime() - call.startedAt.getTime()) / 1000
  }, 0)
  const avgCallSeconds =
    completedInbound.length > 0 ? totalCallSeconds / completedInbound.length : 0
  const uniqueCallers = new Set(inboundCallsRaw.map((call) => call.callerPhone).filter(Boolean))
    .size

  const outcomeCounts = inboundCallsRaw.reduce<Record<string, number>>((acc, call) => {
    const key = call.outcome || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const sortedOutcomes = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])
  const callsLast7 = inboundCallsRaw.filter((call) => call.startedAt >= last7Start).length

  const statusCounts = appointments.reduce<Record<string, number>>((acc, apt) => {
    acc[apt.status] = (acc[apt.status] || 0) + 1
    return acc
  }, {})
  const visitTypeCounts = appointments.reduce<Record<string, number>>((acc, apt) => {
    const key = apt.visitType || 'Unspecified'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const sortedVisitTypes = Object.entries(visitTypeCounts).sort((a, b) => b[1] - a[1])
  const appointmentsLast7 = appointments.filter((apt) => apt.startTime >= last7Start).length
  const noShowRate = appointments.length > 0 ? (statusCounts.no_show || 0) / appointments.length : 0

  const leadTimes = appointments
    .map((apt) => (apt.startTime.getTime() - apt.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    .filter((days) => Number.isFinite(days) && days >= 0)
  const avgLeadTime =
    leadTimes.length > 0 ? leadTimes.reduce((total, days) => total + days, 0) / leadTimes.length : 0

  const recentAppointments = appointments.slice(0, 6)

  const callFromStr = callRangeStart.toISOString().slice(0, 10)
  const callToStr = callRangeEnd.toISOString().slice(0, 10)
  const utcDateFmt: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }
  const callRangeLabel = `${callRangeStart.toLocaleDateString('en-US', utcDateFmt)} – ${callRangeEnd.toLocaleDateString('en-US', utcDateFmt)} (UTC)`

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">
          Call date range uses UTC calendar days so counts align with Retell timestamps. Scheduling
          below still uses the last 30 days in server local time.
        </p>
      </div>

      <div className="space-y-10">
        <Suspense
          fallback={
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-16 text-center text-sm text-gray-500">
              Loading analytics…
            </div>
          }
        >
          <AnalyticsTabs
            reportingRows={inboundCalls}
            inboundCalls={inboundCalls}
            callFrom={callFromStr}
            callTo={callToStr}
            callRangeLabel={callRangeLabel}
            callsLast7={callsLast7}
            uniqueCallers={uniqueCallers}
            avgCallSeconds={avgCallSeconds}
            completedCallCount={completedInbound.length}
            completionRate={
              inboundCallsRaw.length > 0 ? completedInbound.length / inboundCallsRaw.length : 0
            }
            sortedOutcomes={sortedOutcomes}
            updatedAtLabel={format(now, 'MMM d, h:mm a')}
          />
        </Suspense>

        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scheduling Analytics</h2>
            <p className="text-sm text-gray-500">Appointments scheduled in the last 30 days</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">{appointments.length}</div>
                <p className="text-xs text-gray-500 mt-1">{appointmentsLast7} in the last 7 days</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Upcoming (7 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">{upcomingAppointments}</div>
                <p className="text-xs text-gray-500 mt-1">Not cancelled</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">No-show rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">
                  {`${Math.round(noShowRate * 100)}%`}
                </div>
                <p className="text-xs text-gray-500 mt-1">Based on appointment status</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Avg. lead time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">
                  {avgLeadTime ? `${avgLeadTime.toFixed(1)} days` : '—'}
                </div>
                <p className="text-xs text-gray-500 mt-1">Time from creation to visit</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">Status breakdown</CardTitle>
                <CardDescription className="text-sm text-gray-500">Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-sm text-gray-500">No appointments recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(statusCounts).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-sm text-gray-700">
                        <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">Top visit types</CardTitle>
                <CardDescription className="text-sm text-gray-500">Most frequent visit types</CardDescription>
              </CardHeader>
              <CardContent>
                {sortedVisitTypes.length === 0 ? (
                  <p className="text-sm text-gray-500">No visit types recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {sortedVisitTypes.slice(0, 6).map(([visitType, count]) => (
                      <div key={visitType} className="flex items-center justify-between text-sm text-gray-700">
                        <span className="truncate">{visitType}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-900">Recent appointments</CardTitle>
              <CardDescription className="text-sm text-gray-500">Most recent scheduled visits</CardDescription>
            </CardHeader>
            <CardContent>
              {recentAppointments.length === 0 ? (
                <p className="text-sm text-gray-500">No recent appointments.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {recentAppointments.map((apt, index) => (
                    <div
                      key={`${apt.startTime.toISOString()}-${index}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{apt.visitType || 'Visit'}</p>
                        <p className="text-xs text-gray-500">
                          {format(apt.startTime, 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 capitalize">
                        {apt.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
