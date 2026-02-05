import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { getConversationSummary } from '@/lib/communications/summaryService'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:conversations:summary`, 120, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const practiceId = user.practiceId
    const conversationId = params.id

    const exists = await prisma.communicationConversation.findFirst({
      where: { id: conversationId, practiceId },
      select: { id: true },
    })

    if (!exists) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { summary, needsReview } = await getConversationSummary({
      practiceId,
      conversationId,
    })

    return NextResponse.json({ data: { summary, needsReview } })
  } catch (error) {
    console.error('Error fetching summary:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch summary' },
      { status: 500 }
    )
  }
}
