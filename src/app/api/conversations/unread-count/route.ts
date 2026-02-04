import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:conversations:unread-count`, 120, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const practiceId = user.practiceId

    const conversations = await prisma.communicationConversation.findMany({
      where: { practiceId },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            direction: true,
            readAt: true,
          },
        },
      },
    })

    const unreadCount = conversations.reduce((count, conversation) => {
      const latest = conversation.messages[0]
      if (latest?.direction === 'inbound' && !latest.readAt) {
        return count + 1
      }
      return count
    }, 0)

    return NextResponse.json({ data: { unreadCount } })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch unread count' },
      { status: 500 }
    )
  }
}
