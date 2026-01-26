import { redirect } from 'next/navigation'
import { addDays, endOfDay, format, startOfDay, subDays } from 'date-fns'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const formatDuration = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds)) {
    return '—'
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0%'
  }
  return `${Math.round(value * 100)}%`
}

export default async function AnalyticsPage() {
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
    const safeErrorMessage = errorMessage.length > 100 
      ? errorMessage.substring(0, 100) + '...'
      : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
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
  const rangeStart = subDays(startOfDay(now), 30)
  const rangeEnd = endOfDay(now)
  const last7Start = subDays(startOfDay(now), 7)
  const upcomingEnd = addDays(endOfDay(now), 7)

  const [calls, appointments, upcomingAppointments] = await Promise.all([
    prisma.voiceConversation.findMany({
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
      },
      orderBy: {
        startedAt: 'desc',
      },
    }),
    prisma.appointment.findMany({
      where: {
        practiceId,
        startTime: {
          gte: rangeStart,
          lte: rangeEnd,
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

  const completedCalls = calls.filter((call) => call.endedAt)
  const totalCallSeconds = completedCalls.reduce((total, call) => {
    if (!call.endedAt) {
      return total
    }
    return total + Math.max(0, call.endedAt.getTime() - call.startedAt.getTime()) / 1000
  }, 0)
  const avgCallSeconds = completedCalls.length > 0 ? totalCallSeconds / completedCalls.length : 0
  const uniqueCallers = new Set(calls.map((call) => call.callerPhone).filter(Boolean)).size

  const outcomeCounts = calls.reduce<Record<string, number>>((acc, call) => {
    const key = call.outcome || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const sortedOutcomes = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])
  const callsLast7 = calls.filter((call) => call.startedAt >= last7Start).length

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
  const avgLeadTime = leadTimes.length > 0
    ? leadTimes.reduce((total, days) => total + days, 0) / leadTimes.length
    : 0

  const recentCalls = calls.slice(0, 6)
  const recentAppointments = appointments.slice(0, 6)

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">
          Snapshot of calls and scheduling performance • Last 30 days
        </p>
      </div>

      <div className="space-y-10">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Calls Analytics</h2>
              <p className="text-sm text-gray-500">Voice conversations captured in the CRM</p>
            </div>
            <span className="text-xs text-gray-400">
              Updated {format(now, 'MMM d, h:mm a')}
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">{calls.length}</div>
                <p className="text-xs text-gray-500 mt-1">{callsLast7} in the last 7 days</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Unique callers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">{uniqueCallers}</div>
                <p className="text-xs text-gray-500 mt-1">Distinct phone numbers</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Avg. duration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">{formatDuration(avgCallSeconds)}</div>
                <p className="text-xs text-gray-500 mt-1">{completedCalls.length} completed calls</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Completion rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">
                  {formatPercent(calls.length > 0 ? completedCalls.length / calls.length : 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Calls with an end timestamp</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">Call outcomes</CardTitle>
                <CardDescription className="text-sm text-gray-500">Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                {sortedOutcomes.length === 0 ? (
                  <p className="text-sm text-gray-500">No call outcomes recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {sortedOutcomes.map(([outcome, count]) => (
                      <div key={outcome} className="flex items-center justify-between text-sm text-gray-700">
                        <span className="capitalize">{outcome.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">Recent calls</CardTitle>
                <CardDescription className="text-sm text-gray-500">Most recent conversations</CardDescription>
              </CardHeader>
              <CardContent>
                {recentCalls.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent call activity.</p>
                ) : (
                  <div className="space-y-3">
                    {recentCalls.map((call, index) => (
                      <div key={`${call.startedAt.toISOString()}-${index}`} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-gray-900">
                            {call.callerPhone ? call.callerPhone : 'Unknown caller'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(call.startedAt, 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 capitalize">
                          {(call.outcome || 'unknown').replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

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
                <div className="text-2xl font-semibold text-gray-900">{formatPercent(noShowRate)}</div>
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
                    <div key={`${apt.startTime.toISOString()}-${index}`} className="flex items-center justify-between text-sm">
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
