import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db'
import { addDays, endOfDay, format, formatDistanceToNow, startOfDay, subDays } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HealixCommandCenter } from '@/components/healix/HealixCommandCenter'
import { MyTasksCard } from '@/components/dashboard/MyTasksCard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabaseSession = await getSupabaseSession()
  
  // If no Supabase session, check if middleware would allow access (for NextAuth fallback)
  if (!supabaseSession) {
    // Redirect to login - middleware will handle authentication
    redirect('/login')
  }

  // Sync Supabase user to Prisma (creates if doesn't exist)
  const supabaseUser = supabaseSession.user
  console.log('[Dashboard] Syncing user:', supabaseUser.email)
  
  let user
  try {
    user = await syncSupabaseUserToPrisma(supabaseUser)
    console.log('[Dashboard] Sync successful, user ID:', user?.id)
  } catch (error) {
    console.error('[Dashboard] Error syncing user to Prisma:', error)
    // Log the full error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof Error ? error.stack : String(error)
    console.error('[Dashboard] Error details:', errorDetails)
    // If sync fails, redirect to login with error message
    // Include the actual error message in the URL for debugging (truncated if too long)
    const safeErrorMessage = errorMessage.length > 100 
      ? errorMessage.substring(0, 100) + '...'
      : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
  }
  
  if (!user) {
    console.error('[Dashboard] User is null after sync')
    redirect('/login?error=User account not found.')
  }

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    // For Vantage Admins without practiceId, show empty dashboard
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user.name || 'User'}</p>
        </div>
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">
              As a Vantage Admin, you can manage practices from the Settings page.
            </p>
          </div>
        </div>
      </div>
    )
  }
  // TypeScript: practiceId is guaranteed to be non-null after the check above
  const practiceId: string = user.practiceId

  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const windowStart = subDays(today, 7)
  const windowEnd = addDays(endOfDay(now), 7)

  // Get today's appointments
  const appointments = await prisma.appointment.findMany({
    where: {
      practiceId: practiceId,
      startTime: {
        gte: today,
        lt: tomorrow,
      },
      status: {
        not: 'cancelled',
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          phone: true,
          primaryPhone: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
    take: 10,
  })

  // Get recent patients
  const recentPatients = await prisma.patient.findMany({
    where: {
      practiceId: practiceId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  })

  // Rolling 14-day context: past 7 days and next 7 days
  const recentAppointments = await prisma.appointment.findMany({
    where: {
      practiceId: practiceId,
      startTime: {
        gte: windowStart,
        lt: today,
      },
      status: {
        not: 'cancelled',
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          primaryPhone: true,
          phone: true,
        },
      },
    },
    orderBy: {
      startTime: 'desc',
    },
    take: 20,
  })

  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      practiceId: practiceId,
      startTime: {
        gte: today,
        lte: windowEnd,
      },
      status: {
        not: 'cancelled',
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          primaryPhone: true,
          phone: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
    take: 20,
  })

  const recentNotes = await prisma.patientNote.findMany({
    where: {
      practiceId: practiceId,
      deletedAt: null,
      createdAt: {
        gte: windowStart,
        lt: today,
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  })

  // Get users for task assignment dropdown
  const users = await prisma.user.findMany({
    where: {
      practiceId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Get patients for task linking
  const patients = await prisma.patient.findMany({
    where: {
      practiceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryPhone: true,
      phone: true,
    },
    take: 100, // Limit for performance
    orderBy: {
      name: 'asc',
    },
  })

  // Get tasks assigned to current user or unassigned
  // Wrap in try-catch in case Task table doesn't exist yet (migration not run)
  let myTasks: any[] = []
  try {
    myTasks = await prisma.task.findMany({
      where: {
        practiceId: practiceId,
        deletedAt: null,
        status: {
          not: 'completed',
        },
        OR: [
          { assignedTo: user.id },
          { assignedTo: null },
        ],
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 5,
    })
  } catch (error) {
    // Task table might not exist yet - silently fail and show empty tasks
    console.warn('[Dashboard] Tasks table may not exist yet:', error)
    myTasks = []
  }

  const recentPatientMap = new Map<string, { id: string; name: string; lastSeenAt: Date; dateOfBirth?: Date | null }>()
  recentAppointments.forEach((apt) => {
    if (!recentPatientMap.has(apt.patient.id)) {
      recentPatientMap.set(apt.patient.id, {
        id: apt.patient.id,
        name: apt.patient.name,
        lastSeenAt: apt.startTime,
        dateOfBirth: apt.patient.dateOfBirth ?? undefined,
      })
    }
  })

  const upcomingPatientMap = new Map<string, { id: string; name: string; nextVisitAt: Date; dateOfBirth?: Date | null }>()
  upcomingAppointments.forEach((apt) => {
    if (!upcomingPatientMap.has(apt.patient.id)) {
      upcomingPatientMap.set(apt.patient.id, {
        id: apt.patient.id,
        name: apt.patient.name,
        nextVisitAt: apt.startTime,
        dateOfBirth: apt.patient.dateOfBirth ?? undefined,
      })
    }
  })

  const recentPatientsWindow = Array.from(recentPatientMap.values())
  const upcomingPatientsWindow = Array.from(upcomingPatientMap.values())

  const followUpPatients = recentPatientsWindow
    .filter((patient) => !upcomingPatientMap.has(patient.id))
    .slice(0, 5)

  const healixDashboardContext = {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    recentPatients: recentPatientsWindow.map((patient) => ({
      id: patient.id,
      name: patient.name,
      lastSeenAt: patient.lastSeenAt.toISOString(),
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : undefined,
    })),
    upcomingPatients: upcomingPatientsWindow.map((patient) => ({
      id: patient.id,
      name: patient.name,
      nextVisitAt: patient.nextVisitAt.toISOString(),
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : undefined,
    })),
    recentAppointments: recentAppointments.map((apt) => ({
      id: apt.id,
      patientId: apt.patient.id,
      patientName: apt.patient.name,
      startTime: apt.startTime.toISOString(),
      status: apt.status,
      visitType: apt.visitType || null,
    })),
    upcomingAppointments: upcomingAppointments.map((apt) => ({
      id: apt.id,
      patientId: apt.patient.id,
      patientName: apt.patient.name,
      startTime: apt.startTime.toISOString(),
      status: apt.status,
      visitType: apt.visitType || null,
    })),
    recentNotes: recentNotes.map((note) => ({
      id: note.id,
      patientId: note.patientId,
      patientName: note.patient?.name || 'Unknown',
      type: note.type,
      createdAt: note.createdAt.toISOString(),
      contentPreview: note.content.substring(0, 120),
    })),
  }

  const healixContext = {
    route: '/dashboard',
    screenTitle: 'Dashboard',
    dashboardContext: healixDashboardContext,
  }

  const healixStats = {
    recentPatients: recentPatientsWindow.length,
    recentNotes: recentNotes.length,
    upcomingPatients: upcomingPatientsWindow.length,
    upcomingAppointments: upcomingAppointments.length,
  }

  const recentActivity = [
    ...recentAppointments.map((apt) => ({
      id: apt.id,
      type: 'appointment' as const,
      patientId: apt.patient.id,
      patientName: apt.patient.name,
      timestamp: apt.startTime,
      detail: `${apt.visitType || 'Visit'} • ${apt.status}`,
    })),
    ...recentNotes.map((note) => ({
      id: note.id,
      type: 'note' as const,
      patientId: note.patientId,
      patientName: note.patient?.name || 'Unknown',
      timestamp: note.createdAt,
      detail: `${note.type} note`,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 8)

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 min-w-0 max-w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back, {user.name || user.email || 'User'}</p>
      </div>

      <div className="mb-8">
        <HealixCommandCenter context={healixContext} stats={healixStats} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 min-w-0 max-w-full">
        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900">Next 7 Days</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              {upcomingAppointments.length} upcoming appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No upcoming appointments</p>
              ) : (
                upcomingAppointments.slice(0, 6).map((apt: any) => (
                  <div key={apt.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{apt.patient.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {format(apt.startTime, 'MMM d, h:mm a')} • {apt.visitType || 'Visit'}
                      </p>
                    </div>
                    <span className="ml-3 text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
                      {apt.status}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Link href="/appointments">
              <Button variant="ghost" className="w-full mt-4 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                View Schedule →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900">Recent Activity</CardTitle>
            <CardDescription className="text-sm text-gray-500">Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No recent activity</p>
              ) : (
                recentActivity.map((item) => (
                  <Link
                    key={item.id}
                    href={`/patients/${item.patientId}`}
                    className="block py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.patientName}</p>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{item.detail}</p>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900">Needs Follow-up</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Patients seen without a next visit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {followUpPatients.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">All recent patients have upcoming visits</p>
              ) : (
                followUpPatients.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}`}
                    className="block py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{patient.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Last seen {format(patient.lastSeenAt, 'MMM d')}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900">Today&apos;s Appointments</CardTitle>
            <CardDescription className="text-sm text-gray-500">{appointments.length} scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No appointments today</p>
              ) : (
                appointments.map((apt: any) => (
                  <div key={apt.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{apt.patient.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {format(apt.startTime, 'h:mm a')} • {apt.visitType}
                      </p>
                    </div>
                    <span className="ml-3 text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
                      {apt.status}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Link href="/appointments">
              <Button variant="ghost" className="w-full mt-4 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                View All Appointments →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900">Recent Patients</CardTitle>
            <CardDescription className="text-sm text-gray-500">Latest additions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPatients.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No patients yet</p>
              ) : (
                recentPatients.map((patient: any) => (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}`}
                    className="block py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{patient.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{patient.primaryPhone || patient.phone}</p>
                  </Link>
                ))
              )}
            </div>
            <Link href="/patients">
              <Button variant="ghost" className="w-full mt-4 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                View All Patients →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <MyTasksCard
          tasks={myTasks}
          users={users}
          patients={patients}
          currentUserId={user.id}
        />

        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/patients/new">
              <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium">
                Add New Patient
              </Button>
            </Link>
            <Link href="/appointments/new">
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                Schedule Appointment
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" className="w-full text-gray-700 hover:bg-gray-50 font-medium">
                Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

