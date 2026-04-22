import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getRetellClient } from '@/lib/retell-api'
import { initiateInsuranceOutboundCall } from '@/lib/outbound-insurance-call'

export const dynamic = 'force-dynamic'

const initiateOutboundCallSchema = z.object({
  patientId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  insurerPhone: z.string().optional(),
  agentId: z.string().optional(),
})

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

/**
 * Process calls in the background without blocking the API response
 */
async function processCallsInBackground(
  practiceId: string,
  calls: any[],
  retellClient: any,
  userId: string
) {
  console.log(`[Calls API] Processing ${calls.length} calls for patient extraction (background)`)
  
  try {
    const { processRetellCallData } = await import('@/lib/process-call-data')
    
    // Fetch full call details and process each call
    // Only process calls that are ended/completed (they have analysis data)
    const processingPromises = calls
      .filter(call => call.call_status === 'ended' || call.call_status === 'completed')
      .map(async (call) => {
        try {
          // Fetch full call details (includes analysis data)
          const fullCall = await retellClient.getCall(call.call_id)
          if (fullCall) {
            await processRetellCallData(practiceId, fullCall, userId)
            console.log(`[Calls API] Processed call ${call.call_id} for patient extraction`)
          }
        } catch (error) {
          console.error(`[Calls API] Error processing call ${call.call_id}:`, error)
          // Continue processing other calls even if one fails
        }
      })
    
    await Promise.allSettled(processingPromises)
    console.log(`[Calls API] Finished background processing calls`)
  } catch (error) {
    console.error('[Calls API] Error in background processing:', error)
  }
}

/**
 * GET /api/calls
 * List calls from RetellAI
 * Optionally process calls for patient extraction (query param: ?process=true)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId
    
    const searchParams = req.nextUrl.searchParams
    
    const agentId = searchParams.get('agentId') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    const shouldProcess = searchParams.get('process') === 'true'
    
    // Optional date range filters
    const startTimestamp = searchParams.get('startTimestamp') 
      ? parseInt(searchParams.get('startTimestamp')!) 
      : undefined
    const endTimestamp = searchParams.get('endTimestamp')
      ? parseInt(searchParams.get('endTimestamp')!)
      : undefined

    const retellClient = await getRetellClient(practiceId)
    const result = await retellClient.listCalls({
      agentId,
      limit,
      offset,
      startTimestamp,
      endTimestamp,
    })

    const calls = result.calls || []
    const callIds = calls
      .map((call) => call.call_id)
      .filter((id): id is string => Boolean(id))

    const conversations = callIds.length
      ? await prisma.voiceConversation.findMany({
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
      : []

    const conversationByCallId = new Map(
      conversations
        .filter((conv): conv is typeof conv & { retellCallId: string } => Boolean(conv.retellCallId))
        .map((conv) => [conv.retellCallId, conv])
    )

    const enrichedCalls = calls.map((call) => {
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

    // Fetch call IDs that have been reviewed by any user in this practice
    let reviewedCallIds: string[] = []
    try {
      const reviews = await prisma.callReview.findMany({
        where: { practiceId },
        select: { callId: true },
        distinct: ['callId'],
      })
      reviewedCallIds = reviews.map((r) => r.callId)
    } catch (e) {
      // Table may not exist yet if migration not run
    }

    // Return calls + reviewed IDs for unread flags
    const response = NextResponse.json({ ...result, calls: enrichedCalls, reviewedCallIds })
    
    // If processing is requested, do it in the background (don't await)
    if (shouldProcess && calls.length > 0) {
      // Process calls asynchronously without blocking the response
      // Fire and forget - the user gets the data immediately
      processCallsInBackground(practiceId, calls, retellClient, user.id).catch(err => {
        console.error('[Calls API] Background processing error:', err)
      })
    }
    
    return response
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch calls',
        calls: [],
        reviewedCallIds: [],
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calls
 * Initiate an outbound insurance verification call via Retell MCP tools/call.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }
    const practiceId = user.practiceId
    const body = await req.json()
    const parsed = initiateOutboundCallSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request payload' }, { status: 400 })
    }

    const { patientId, policyId, insurerPhone, agentId } = parsed.data
    const result = await initiateInsuranceOutboundCall({
      practiceId,
      userId: user.id,
      patientId,
      policyId,
      insurerPhone,
      agentId,
      source: 'api',
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error initiating outbound insurance call:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate outbound insurance call' },
      { status: 500 }
    )
  }
}

