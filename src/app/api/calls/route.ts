import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellClient } from '@/lib/retell-api'
import { processRetellCallData } from '@/lib/process-call-data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calls
 * List calls from RetellAI
 * Optionally process calls for patient extraction (query param: ?process=true)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
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

    const retellClient = await getRetellClient(user.practiceId)
    const result = await retellClient.listCalls({
      agentId,
      limit,
      offset,
      startTimestamp,
      endTimestamp,
    })

    const calls = result.calls || []

    // Process calls for patient extraction if requested
    if (shouldProcess && calls.length > 0) {
      console.log(`[Calls API] Processing ${calls.length} calls for patient extraction`)
      
      // Fetch full call details and process each call
      // Only process calls that are ended/completed (they have analysis data)
      const processingPromises = calls
        .filter(call => call.call_status === 'ended' || call.call_status === 'completed')
        .map(async (call) => {
          try {
            // Fetch full call details (includes analysis data)
            const fullCall = await retellClient.getCall(call.call_id)
            if (fullCall) {
              await processRetellCallData(user.practiceId, fullCall, user.id)
              console.log(`[Calls API] Processed call ${call.call_id} for patient extraction`)
            }
          } catch (error) {
            console.error(`[Calls API] Error processing call ${call.call_id}:`, error)
            // Continue processing other calls even if one fails
          }
        })
      
      await Promise.allSettled(processingPromises)
      console.log(`[Calls API] Finished processing calls`)
    }

    return NextResponse.json(result)
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

