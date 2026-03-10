import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/calls/[id]/review
 * Mark a call as reviewed by the current user (for unread tracking).
 * When any user in the practice views the call, it is considered "read".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: callId } = await params

    if (!callId) {
      return NextResponse.json({ error: 'Call ID is required' }, { status: 400 })
    }

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    await prisma.callReview.upsert({
      where: {
        callId_practiceId_userId: {
          callId,
          practiceId: user.practiceId,
          userId: user.id,
        },
      },
      create: {
        callId,
        practiceId: user.practiceId,
        userId: user.id,
      },
      update: { reviewedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking call as reviewed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark as reviewed' },
      { status: 500 }
    )
  }
}
