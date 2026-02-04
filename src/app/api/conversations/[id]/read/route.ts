import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:conversations:read`, 120, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const practiceId = user.practiceId
    const conversationId = params.id

    const result = await prisma.communicationMessage.updateMany({
      where: {
        practiceId,
        conversationId,
        direction: 'inbound',
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    })

    return NextResponse.json({ data: { updated: result.count } })
  } catch (error) {
    console.error('Error marking conversation read:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark conversation read' },
      { status: 500 }
    )
  }
}
