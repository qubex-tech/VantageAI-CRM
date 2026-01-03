import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { CallsList } from '@/components/calls/CallsList'

export const dynamic = 'force-dynamic'

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    const safeErrorMessage = errorMessage.length > 100 
      ? errorMessage.substring(0, 100) + '...'
      : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
  }
  
  if (!user) {
    redirect('/login?error=User account not found.')
  }

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    // Return empty calls list for users without practiceId - redirect to dashboard instead
    redirect('/dashboard')
  }
  const practiceId = user.practiceId

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
      const retellClient = await getRetellClient(practiceId)
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

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <CallsList initialCalls={calls} error={error} />
    </div>
  )
}
