import { redirect, notFound } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { RetellCall } from '@/lib/retell-api'

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: callId } = await params
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

  // Fetch call details from RetellAI API
  let call: RetellCall | null = null
  let error: string | null = null

  try {
    const { getRetellClient } = await import('@/lib/retell-api')
    const retellClient = await getRetellClient(user.practiceId)
    call = await retellClient.getCall(callId)

    // Process call data to extract patient information and create/update patient
    if (call) {
      try {
        const { processRetellCallData } = await import('@/lib/process-call-data')
        await processRetellCallData(user.practiceId, call, user.id)
      } catch (processError) {
        // Log but don't fail the page load if processing fails
        console.error('Error processing call data:', processError)
      }
    }
  } catch (err) {
    console.error('Error fetching call details:', err)
    if (err instanceof Error && err.message.includes('404')) {
      notFound()
    }
    error = err instanceof Error ? err.message : 'Failed to fetch call details'
  }

  if (error) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <Card className="border border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!call) {
    notFound()
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ended':
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'in-progress':
      case 'ongoing':
        return 'bg-blue-100 text-blue-700'
      case 'registered':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Call Details</h1>
        <p className="text-sm text-gray-500">
          Call ID: {call.call_id}
        </p>
      </div>

      <div className="space-y-4">
        {/* Call Overview */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <p>
                  <span className={`inline-block text-xs px-2 py-1 rounded-md font-medium mt-1 ${getStatusColor(call.call_status)}`}>
                    {call.call_status}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Call Type</p>
                <p className="text-sm text-gray-900 mt-1 capitalize">
                  {call.call_type.replace('_', ' ')}
                </p>
              </div>
              {call.start_timestamp && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Start Time</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {format(new Date(call.start_timestamp), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
              {call.end_timestamp && (
                <div>
                  <p className="text-sm font-medium text-gray-500">End Time</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {format(new Date(call.end_timestamp), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
              {call.duration_ms && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDuration(call.duration_ms)}
                  </p>
                </div>
              )}
              {call.disconnection_reason && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Disconnection Reason</p>
                  <p className="text-sm text-gray-900 mt-1 capitalize">
                    {call.disconnection_reason.replace('_', ' ')}
                  </p>
                </div>
              )}
            </div>
            {call.agent_id && (
              <div>
                <p className="text-sm font-medium text-gray-500">Agent ID</p>
                <p className="text-sm text-gray-900 mt-1">{call.agent_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transcript */}
        {call.transcript && (
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-md">
                  {call.transcript}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Call Analysis */}
        {call.call_analysis && (
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Call Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {call.call_analysis.call_summary && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Summary</p>
                  <p className="text-sm text-gray-700">{call.call_analysis.call_summary}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {call.call_analysis.user_sentiment && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Sentiment</p>
                    <p className="text-sm text-gray-900 mt-1">{call.call_analysis.user_sentiment}</p>
                  </div>
                )}
                {call.call_analysis.call_successful !== undefined && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Call Successful</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {call.call_analysis.call_successful ? 'Yes' : 'No'}
                    </p>
                  </div>
                )}
                {call.call_analysis.in_voicemail !== undefined && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Voicemail</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {call.call_analysis.in_voicemail ? 'Yes' : 'No'}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Extracted Data */}
              {call.call_analysis.custom_analysis_data && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-500 mb-3">Extracted Data</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(call.call_analysis.custom_analysis_data as Record<string, any>).map(([key, value]) => {
                      if (value === null || value === undefined || value === '') return null
                      return (
                        <div key={key}>
                          <p className="text-sm font-medium text-gray-500 capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-900 mt-1">
                            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recording URLs */}
        {(call.recording_url || call.public_log_url) && (
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Recordings & Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {call.recording_url && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Recording</p>
                  <a
                    href={call.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Download Recording
                  </a>
                </div>
              )}
              {call.public_log_url && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Public Log</p>
                  <a
                    href={call.public_log_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View Log
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

