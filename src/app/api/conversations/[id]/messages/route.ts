import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:conversations:messages`, 240, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const conversation = await prisma.communicationConversation.findFirst({
      where: {
        id: params.id,
        practiceId: user.practiceId,
      },
      select: { id: true, patientId: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const messages = await prisma.communicationMessage.findMany({
      where: {
        conversationId: conversation.id,
        practiceId: user.practiceId,
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            url: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      data: {
        messages: messages.map((message) => ({
          id: message.id,
          body: message.body,
          type: message.type,
          direction: message.direction,
          channel: message.channel,
          deliveryStatus: message.deliveryStatus,
          createdAt: message.createdAt,
          readAt: message.readAt,
          intent: message.intent,
          intentConfidence: message.intentConfidence,
          author: message.author,
          attachments: message.attachments,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
