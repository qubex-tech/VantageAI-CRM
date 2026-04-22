import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
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
  patientTypeLabel?: 'New Patient' | 'Existing Patient' | 'Other'
  callerDisplayName?: string
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function booleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1'].includes(normalized)) return true
    if (['false', 'no', '0'].includes(normalized)) return false
  }
  return undefined
}

function detectPatientType(metadata: Record<string, unknown>): 'New Patient' | 'Existing Patient' | 'Other' {
  const custom = asObject(metadata.retell_custom_data)
  const patientTypeRaw =
    metadata.patient_type ??
    metadata.patientType ??
    custom.patient_type ??
    custom.patientType ??
    custom['Patient Type']

  const newPatientFlag = booleanLike(
    metadata.new_patient_add ??
      custom.new_patient_add ??
      custom['New Patient Add']
  )
  const existingPatientFlag = booleanLike(
    metadata.existing_patient_update ??
      custom.existing_patient_update ??
      custom['Existing Patient Update']
  )

  if (newPatientFlag === true) return 'New Patient'
  if (existingPatientFlag === true) return 'Existing Patient'

  if (typeof patientTypeRaw === 'string') {
    const lower = patientTypeRaw.toLowerCase()
    if (lower.includes('new')) return 'New Patient'
    if (lower.includes('exist') || lower.includes('return') || lower.includes('establish')) {
      return 'Existing Patient'
    }
  }

  return 'Other'
}

function detectCallerName(metadata: Record<string, unknown>, fallbackPhone?: string | null): string {
  const custom = asObject(metadata.retell_custom_data)
  const first = (custom['Patient First Name'] || custom.patient_first_name) as string | undefined
  const last = (custom['Patient Last Name'] || custom.patient_last_name) as string | undefined
  const fullFromParts = `${first || ''} ${last || ''}`.trim()

  return (
    (metadata.patient_name as string | undefined) ||
    (metadata.caller_name as string | undefined) ||
    (custom.patient_name as string | undefined) ||
    (custom['Caller Name'] as string | undefined) ||
    fullFromParts ||
    (fallbackPhone || '').trim() ||
    'Unknown Caller'
  )
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

      const callIds = calls
        .map((call) => call.call_id)
        .filter((id): id is string => Boolean(id))

      if (callIds.length > 0) {
        const conversations = await prisma.voiceConversation.findMany({
          where: {
            practiceId,
            retellCallId: { in: callIds },
          },
          select: {
            retellCallId: true,
            metadata: true,
            patient: {
              select: {
                name: true,
              },
            },
          },
        })

        const conversationByCallId = new Map(
          conversations
            .filter((conv): conv is typeof conv & { retellCallId: string } => Boolean(conv.retellCallId))
            .map((conv) => [conv.retellCallId, conv])
        )

        calls = calls.map((call) => {
          const conversation = conversationByCallId.get(call.call_id)
          const metadata = asObject(conversation?.metadata)
          const patientTypeLabel = detectPatientType(metadata)
          const callerDisplayName = conversation?.patient?.name || detectCallerName(metadata, null)

          return {
            ...call,
            patientTypeLabel,
            callerDisplayName,
          }
        })
      }
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

  let reviewedCallIds: string[] = []
  try {
    const reviews = await prisma.callReview.findMany({
      where: { practiceId },
      select: { callId: true },
      distinct: ['callId'],
    })
    reviewedCallIds = reviews.map((r) => r.callId)
  } catch {
    // call_reviews table may not exist yet
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <CallsList initialCalls={calls} initialReviewedCallIds={reviewedCallIds} error={error} />
    </div>
  )
}
