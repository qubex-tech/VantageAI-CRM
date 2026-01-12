import { redirect } from 'next/navigation'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { format } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

/**
 * Portal Appointments Page
 * Shows patient's appointments with ability to confirm, cancel, or request reschedule
 */
export default async function PortalAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>
}) {
  const session = await getPatientSession()
  
  if (!session) {
    redirect('/portal/auth')
  }
  
  const params = await searchParams
  const { patientId, practiceId } = session
  
  const date = params.date ? new Date(params.date) : null
  const status = params.status
  
  // Build where clause for appointments
  const where: any = {
    practiceId,
    patientId,
  }
  
  // If a specific date is provided, filter to that day
  // Otherwise, show all appointments (past and future)
  if (date) {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    where.startTime = {
      gte: startOfDay,
      lte: endOfDay,
    }
  }
  
  if (status) {
    where.status = status
  }
  
  // Get appointments
  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startTime: 'desc' },
    take: 100,
  })
  
  // Get patient info for display
  const patient = await prisma.patient.findUnique({
    where: {
      id: patientId,
      practiceId,
    },
    include: {
      practice: {
        select: {
          name: true,
        },
      },
    },
  })
  
  if (!patient) {
    redirect('/portal/auth')
  }
  
  const getStatusBadge = (status: string) => {
    const baseClasses = 'text-xs px-2 py-1 rounded-full font-medium'
    switch (status) {
      case 'confirmed':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'scheduled':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'completed':
        return `${baseClasses} bg-gray-100 text-gray-800`
      case 'cancelled':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }
  
  const canConfirm = (apt: any) => {
    return apt.status === 'scheduled' && new Date(apt.startTime) > new Date()
  }
  
  const canCancel = (apt: any) => {
    return (apt.status === 'scheduled' || apt.status === 'confirmed') && 
           new Date(apt.startTime) > new Date()
  }
  
  const canReschedule = (apt: any) => {
    return (apt.status === 'scheduled' || apt.status === 'confirmed') && 
           new Date(apt.startTime) > new Date()
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-2">
            {patient.practice.name}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {date ? format(date, 'MMMM d, yyyy') : 'All appointments'}
          </p>
        </div>
        
        {appointments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No appointments found</p>
            <p className="text-sm text-gray-400 mt-2">
              {date ? 'No appointments on this date' : 'You don\'t have any appointments yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => (
              <div key={apt.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {apt.visitType}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Date:</span>{' '}
                        {format(new Date(apt.startTime), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p>
                        <span className="font-medium">Time:</span>{' '}
                        {format(new Date(apt.startTime), 'h:mm a')} - {format(new Date(apt.endTime), 'h:mm a')}
                      </p>
                      {apt.reason && (
                        <p>
                          <span className="font-medium">Reason:</span> {apt.reason}
                        </p>
                      )}
                      {apt.notes && (
                        <p>
                          <span className="font-medium">Notes:</span> {apt.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={getStatusBadge(apt.status)}>
                      {apt.status}
                    </span>
                    {apt.status === 'scheduled' && (
                      <span className="text-xs text-gray-500">
                        Action needed
                      </span>
                    )}
                  </div>
                </div>
                
                {(canConfirm(apt) || canCancel(apt) || canReschedule(apt)) && (
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    {canConfirm(apt) && (
                      <form
                        action={`/api/portal/appointments/${apt.id}/confirm`}
                        method="POST"
                        className="flex-1"
                      >
                        <button
                          type="submit"
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Confirm Appointment
                        </button>
                      </form>
                    )}
                    {canReschedule(apt) && (
                      <Link
                        href={`/portal/appointments/${apt.id}/reschedule`}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium text-center"
                      >
                        Request Reschedule
                      </Link>
                    )}
                    {canCancel(apt) && (
                      <form
                        action={`/api/portal/appointments/${apt.id}/cancel`}
                        method="POST"
                        className="flex-1"
                      >
                        <button
                          type="submit"
                          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
