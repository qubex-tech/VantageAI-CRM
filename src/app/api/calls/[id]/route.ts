import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellClient } from '@/lib/retell-api'

/**
 * GET /api/calls/[id]
 * Get details of a specific call from RetellAI
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: callId } = await params

    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      )
    }

    const retellClient = getRetellClient()
    const call = await retellClient.getCall(callId)

    return NextResponse.json({ call })
  } catch (error) {
    console.error('Error fetching call details:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch call details' 
      },
      { status: 500 }
    )
  }
}

