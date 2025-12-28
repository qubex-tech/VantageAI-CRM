import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: { date?: string; status?: string }
}) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login')
  }

  const date = searchParams.date ? new Date(searchParams.date) : new Date()
  const status = searchParams.status

  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const where: any = {
    practiceId: session.user.practiceId,
    startTime: {
      gte: startOfDay,
      lte: endOfDay,
    },
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
          {format(date, 'MMMM d, yyyy')}
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

