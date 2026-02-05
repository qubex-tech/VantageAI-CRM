import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { generateConversationSummary } from '@/lib/communications/summaryService'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:conversations:summarize`, 40, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const practiceId = user.practiceId
    const conversationId = params.id
    const body = await req.json().catch(() => ({}))
    const rawLimit = Number(body?.messageLimit ?? 20)
    const messageLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 5), 100) : 20

    const exists = await prisma.communicationConversation.findFirst({
      where: { id: conversationId, practiceId },
      select: { id: true },
    })

    if (!exists) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { summary, needsReview } = await generateConversationSummary({
      practiceId,
      conversationId,
      messageLimit,
      actorUserId: user.id,
    })

    return NextResponse.json({ data: { summary, needsReview } })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
