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

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const retellClient = await getRetellClient(practiceId)
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

