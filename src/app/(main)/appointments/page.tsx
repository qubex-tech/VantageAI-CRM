import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>
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
    redirect('/login?error=Failed to sync user account. Please try again.')
  }
  
  if (!user) {
    redirect('/login?error=User account not found.')
  }

  const date = params.date ? new Date(params.date) : null
  const status = params.status

  const where: any = {
    practiceId: user.practiceId,
  }

  // If a specific date is provided, filter to that day
  // Otherwise, show all upcoming appointments (from today onwards)
  if (date) {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    where.startTime = {
      gte: startOfDay,
      lte: endOfDay,
    }
  } else {
    // Show all future appointments by default
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    where.startTime = {
      gte: today,
    }
  }

  if (status) {
    where.status = status
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Appointments</h1>
        <p className="text-sm text-gray-500">
          {date ? format(date, 'MMMM d, yyyy') : 'Upcoming appointments'}
        </p>
      </div>

      {appointments.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">No appointments scheduled</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt: any) => (
            <Link key={apt.id} href={`/appointments/${apt.id}`}>
              <Card className="border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-900">{apt.patient.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {format(apt.startTime, 'h:mm a')} • {apt.visitType}
                    </p>
                    {apt.reason && (
                      <p className="text-sm text-gray-700">{apt.reason}</p>
                    )}
                    <span className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
                      {apt.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
