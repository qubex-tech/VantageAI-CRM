import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { communicationNoteSchema } from '@/lib/validations'
import { emitCommunicationEvent } from '@/lib/communications/events'
import type { CommunicationChannel } from '@/lib/communications/types'
import { ensureCommunicationRuntime } from '@/lib/communications/runtime'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }
    const practiceId = user.practiceId

    if (!rateLimit(`${user.id}:conversations:note`, 80, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const validated = communicationNoteSchema.parse(body)

    const conversation = await prisma.communicationConversation.findFirst({
      where: {
        id: params.id,
        practiceId,
      },
      select: { id: true, patientId: true, channel: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    const channel = conversation.channel as CommunicationChannel

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.communicationMessage.create({
        data: {
          practiceId,
          conversationId: conversation.id,
          patientId: conversation.patientId,
          authorUserId: user.id,
          direction: 'internal',
          type: 'note',
          body: validated.body,
          channel,
          deliveryStatus: 'sent',
        },
      })

      await tx.communicationConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: validated.body.slice(0, 140),
        },
      })

      await tx.auditLog.create({
        data: {
          practiceId,
          userId: user.id,
          action: 'note',
          resourceType: 'conversation',
          resourceId: conversation.id,
          changes: {
            messageId: created.id,
          },
        },
      })

      return created
    })

    ensureCommunicationRuntime()
    await emitCommunicationEvent({
      type: 'message.sent',
      practiceId,
      conversationId: conversation.id,
      patientId: conversation.patientId,
      messageId: message.id,
      channel,
      actorUserId: user.id,
    })

    return NextResponse.json({ data: { messageId: message.id } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error adding note:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add note' },
      { status: 500 }
    )
  }
}
