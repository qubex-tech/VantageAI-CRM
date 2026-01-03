import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellClient } from '@/lib/retell-api'

export const dynamic = 'force-dynamic'

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

    // Return calls immediately, process in background if requested
    // This ensures the API responds quickly and the UI is not blocked
    const response = NextResponse.json(result)
    
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
        calls: [] 
      },
      { status: 500 }
    )
  }
}

