import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { formatAppointmentDate, formatAppointmentTime } from '@/lib/portal-date-utils'
import { resolveTimeZone } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

/**
 * Portal Home Page
 * Shows dashboard if logged in, redirects to auth if not
 */
export default async function PortalHomePage() {
  const session = await getPatientSession()
  
  if (!session) {
    redirect('/portal/auth')
  }
  
  // Detect user's timezone from IP address
  const headersList = await headers()
  const userTimezone = await resolveTimeZone(headersList) || 'UTC'
  
  // Get patient info
  const patient = await prisma.patient.findUnique({
    where: {
      id: session.patientId,
      practiceId: session.practiceId,
    },
    include: {
      practice: {
        select: {
          name: true,
        },
      },
      appointments: {
        take: 10,
        orderBy: { startTime: 'asc' },
        where: {
          startTime: {
            gte: new Date(),
          },
          status: {
            not: 'cancelled',
          },
        },
      },
      portalTasks: {
        take: 5,
        where: {
          status: {
            in: ['pending', 'in_progress'],
          },
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  })
  
  if (!patient) {
    redirect('/portal/auth')
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {patient.firstName || patient.name.split(' ')[0] || 'Patient'}
          </h1>
          <p className="text-gray-600 mt-2">
            {patient.practice.name} Patient Portal
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Upcoming Appointments</h2>
            {patient.appointments.length === 0 ? (
              <p className="text-gray-500">No upcoming appointments</p>
            ) : (
              <>
                <ul className="space-y-3">
                  {patient.appointments.map((apt) => (
                    <li key={apt.id} className="border-b border-gray-200 pb-3 last:border-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{apt.visitType}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatAppointmentDate(apt.startTime, userTimezone)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatAppointmentTime(apt.startTime, userTimezone)}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          apt.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          apt.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <a
                  href="/portal/appointments"
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800 block text-center"
                >
                  View all appointments →
                </a>
              </>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Tasks</h2>
            {patient.portalTasks.length === 0 ? (
              <p className="text-gray-500">No pending tasks</p>
            ) : (
              <ul className="space-y-2">
                {patient.portalTasks.map((task) => {
                  const formRequestId = (task.metadata as any)?.formRequestId
                  return (
                    <li key={task.id} className="border-b pb-2">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-gray-600">{task.description}</p>
                      {formRequestId && (
                        <a
                          href={`/portal/forms/${formRequestId}`}
                          className="mt-2 inline-flex text-sm text-blue-600 hover:text-blue-800"
                        >
                          Complete form →
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
        
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/portal/appointments"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              Appointments
            </a>
            <a
              href="/portal/messages"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              Messages
            </a>
            <a
              href="/portal/preferences"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              Preferences
            </a>
            <a
              href="/portal/activity"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              Activity
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
