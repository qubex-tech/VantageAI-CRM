import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellClient } from '@/lib/retell-api'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calls
 * List calls from RetellAI
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    
    const agentId = searchParams.get('agentId') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    
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

