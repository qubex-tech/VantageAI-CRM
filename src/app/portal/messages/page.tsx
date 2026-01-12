import { redirect } from 'next/navigation'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { format } from 'date-fns'
import { BackButton } from '@/components/portal/BackButton'

/**
 * Portal Messages Page
 * Shows all communications (emails, SMS, portal messages)
 */
export default async function PortalMessagesPage() {
  const session = await getPatientSession()
  
  if (!session) {
    redirect('/portal/auth')
  }
  
  // Get patient messages
  const threads = await prisma.conversationThread.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1, // Get latest message for preview
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  })
  
  // Get unthreaded messages
  const unthreadedMessages = await prisma.portalMessage.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
      threadId: null,
    },
    orderBy: { createdAt: 'desc' },
  })
  
  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return 'Email'
      case 'SMS': return 'SMS'
      case 'PORTAL': return 'Portal Message'
      case 'VOICE': return 'Voice'
      default: return channel
    }
  }
  
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return '📧'
      case 'SMS': return '💬'
      case 'PORTAL': return '💬'
      case 'VOICE': return '📞'
      default: return '📨'
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="mb-4">
            <BackButton />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-2">View your communications with the practice</p>
        </div>
        
        {threads.length === 0 && unthreadedMessages.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No messages yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Messages from the practice will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Threaded messages */}
            {threads.map((thread) => {
              const latestMessage = thread.messages[0]
              return (
                <div key={thread.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{getChannelIcon(latestMessage?.channel || 'PORTAL')}</span>
                        <h3 className="font-semibold text-gray-900">
                          {thread.subject || 'No Subject'}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {getChannelLabel(latestMessage?.channel || 'PORTAL')}
                        </span>
                      </div>
                      {latestMessage && (
                        <>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {latestMessage.body.replace(/<[^>]*>/g, '').substring(0, 150)}
                            {latestMessage.body.length > 150 ? '...' : ''}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              {latestMessage.direction === 'outbound' ? 'From practice' : 'You'}
                            </span>
                            <span>•</span>
                            <span>
                              {format(new Date(latestMessage.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                            {latestMessage.status === 'read' && (
                              <>
                                <span>•</span>
                                <span className="text-green-600">Read</span>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      thread.status === 'open' ? 'bg-blue-100 text-blue-800' :
                      thread.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {thread.status}
                    </span>
                  </div>
                </div>
              )
            })}
            
            {/* Unthreaded messages */}
            {unthreadedMessages.map((message) => (
              <div key={message.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{getChannelIcon(message.channel)}</span>
                      <h3 className="font-semibold text-gray-900">
                        {message.subject || getChannelLabel(message.channel)}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {getChannelLabel(message.channel)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {message.body.replace(/<[^>]*>/g, '').substring(0, 150)}
                      {message.body.length > 150 ? '...' : ''}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        {message.direction === 'outbound' ? 'From practice' : 'You'}
                      </span>
                      <span>•</span>
                      <span>
                        {format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                      {message.status === 'read' && (
                        <>
                          <span>•</span>
                          <span className="text-green-600">Read</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    message.status === 'read' ? 'bg-green-100 text-green-800' :
                    message.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {message.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
