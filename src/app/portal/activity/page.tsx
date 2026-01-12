import { redirect } from 'next/navigation'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { format } from 'date-fns'

/**
 * Portal Activity Page
 * Shows unified patient activity timeline
 */
export default async function PortalActivityPage() {
  const session = await getPatientSession()
  
  if (!session) {
    redirect('/portal/auth')
  }
  
  // Get timeline entries (similar to CRM)
  const timelineEntries = await prisma.patientTimelineEntry.findMany({
    where: {
      patientId: session.patientId,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  
  // Get appointments
  const appointments = await prisma.appointment.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    orderBy: { startTime: 'desc' },
    take: 50,
  })
  
  // Get messages
  const messages = await prisma.portalMessage.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  
  // Get tasks
  const tasks = await prisma.patientTask.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  
  // Get consent records
  const consentRecords = await prisma.consentRecord.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  
  // Combine all events
  const events = [
    ...timelineEntries.map(e => ({
      type: 'timeline' as const,
      id: e.id,
      timestamp: e.createdAt,
      data: e,
    })),
    ...appointments.map(a => ({
      type: 'appointment' as const,
      id: a.id,
      timestamp: a.createdAt,
      data: a,
    })),
    ...messages.map(m => ({
      type: 'message' as const,
      id: m.id,
      timestamp: m.createdAt,
      data: m,
    })),
    ...tasks.map(t => ({
      type: 'task' as const,
      id: t.id,
      timestamp: t.createdAt,
      data: t,
    })),
    ...consentRecords.map(c => ({
      type: 'consent' as const,
      id: c.id,
      timestamp: c.createdAt,
      data: c,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'appointment': return '📅'
      case 'message': return '💬'
      case 'task': return '✓'
      case 'consent': return '📋'
      case 'email': return '📧'
      case 'call': return '📞'
      case 'note': return '📝'
      case 'document': return '📄'
      default: return '•'
    }
  }
  
  const getEventTitle = (event: any) => {
    switch (event.type) {
      case 'timeline':
        return event.data.title
      case 'appointment':
        return `${event.data.visitType} - ${event.data.status}`
      case 'message':
        return event.data.subject || `${event.data.channel} message`
      case 'task':
        return event.data.title
      case 'consent':
        return `Consent: ${event.data.consentType}`
      default:
        return 'Activity'
    }
  }
  
  const getEventDescription = (event: any) => {
    switch (event.type) {
      case 'timeline':
        return event.data.description
      case 'appointment':
        return `Scheduled for ${format(new Date(event.data.startTime), 'MMM d, yyyy h:mm a')}`
      case 'message':
        return event.data.body?.substring(0, 100) + (event.data.body?.length > 100 ? '...' : '')
      case 'task':
        return event.data.description
      case 'consent':
        return event.data.consented ? 'Consented' : 'Not consented'
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Activity</h1>
          <p className="text-gray-600 mt-2">View all your activity and interactions</p>
        </div>
        
        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No activity yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Your activity will appear here
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="divide-y divide-gray-200">
              {events.map((event) => {
                const date = format(new Date(event.timestamp), 'MMM d, yyyy')
                const time = format(new Date(event.timestamp), 'h:mm a')
                
                return (
                  <div key={`${event.type}-${event.id}`} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">{getEventIcon(event.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">
                              {getEventTitle(event)}
                            </h3>
                            {getEventDescription(event) && (
                              <p className="text-sm text-gray-600 mt-1">
                                {getEventDescription(event)}
                              </p>
                            )}
                            {event.type === 'appointment' && (
                              <div className="mt-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  event.data.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                  event.data.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                  event.data.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                  event.data.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {event.data.status}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-right text-sm text-gray-500 whitespace-nowrap">
                            <div>{date}</div>
                            <div>{time}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
