import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface RetellCallListItem {
  call_id: string
  call_type: 'phone_call' | 'web_call'
  agent_id: string
  call_status: string
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string; limit?: string }>
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

  // Fetch calls from RetellAI API via our API route
  let calls: RetellCallListItem[] = []
  let error: string | null = null

  try {
    const agentId = params.agentId || undefined
    const limit = params.limit ? parseInt(params.limit) : 50

    // Use RetellAI client directly in server component
    // Get API key from database (per-practice configuration)
    try {
      const { getRetellClient } = await import('@/lib/retell-api')
      const retellClient = await getRetellClient(user.practiceId)
      const result = await retellClient.listCalls({
        agentId,
        limit,
      })
      calls = result.calls || []
    } catch (err) {
      if (err instanceof Error && err.message.includes('not configured')) {
        error = 'RetellAI integration not configured. Please configure it in Settings.'
      } else {
        throw err
      }
    }
  } catch (err) {
    console.error('Error fetching calls:', err)
    error = err instanceof Error ? err.message : 'Failed to fetch calls'
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
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Calls</h1>
        <p className="text-sm text-gray-500">
          Voice agent calls from RetellAI
        </p>
      </div>

      {error ? (
        <Card className="border border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-red-500 mt-2">
              {error.includes('not configured') && 'Please configure your RetellAI integration in Settings.'}
            </p>
          </CardContent>
        </Card>
      ) : calls.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">No calls found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <Link key={call.call_id} href={`/calls/${call.call_id}`}>
              <Card className="border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-900">
                      Call {call.call_id.slice(0, 8)}...
                    </CardTitle>
                    <span className={`inline-block text-xs px-2 py-1 rounded-md font-medium ${getStatusColor(call.call_status)}`}>
                      {call.call_status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {call.start_timestamp && (
                        <span>
                          {format(new Date(call.start_timestamp), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      {call.duration_ms && (
                        <span>• {formatDuration(call.duration_ms)}</span>
                      )}
                      <span className="capitalize">• {call.call_type.replace('_', ' ')}</span>
                    </div>
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

