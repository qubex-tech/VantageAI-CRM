import { redirect } from 'next/navigation'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'

/**
 * Portal Home Page
 * Shows dashboard if logged in, redirects to auth if not
 */
export default async function PortalHomePage() {
  const session = await getPatientSession()
  
  if (!session) {
    redirect('/portal/auth')
  }
  
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
        take: 5,
        orderBy: { startTime: 'desc' },
        where: {
          startTime: {
            gte: new Date(),
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
              <ul className="space-y-2">
                {patient.appointments.map((apt) => (
                  <li key={apt.id} className="border-b pb-2">
                    <p className="font-medium">{apt.visitType}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(apt.startTime).toLocaleDateString()} at{' '}
                      {new Date(apt.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Tasks</h2>
            {patient.portalTasks.length === 0 ? (
              <p className="text-gray-500">No pending tasks</p>
            ) : (
              <ul className="space-y-2">
                {patient.portalTasks.map((task) => (
                  <li key={task.id} className="border-b pb-2">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-gray-600">{task.description}</p>
                  </li>
                ))}
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
