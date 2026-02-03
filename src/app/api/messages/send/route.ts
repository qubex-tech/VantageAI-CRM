import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { communicationMessageSendSchema } from '@/lib/validations'
import { getChannelAdapter } from '@/lib/communications/adapters'
import { emitCommunicationEvent } from '@/lib/communications/events'
import { ensureCommunicationRuntime } from '@/lib/communications/runtime'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }
    const practiceId = user.practiceId

    if (!rateLimit(`${user.id}:messages:send`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const validated = communicationMessageSendSchema.parse(body)

    const conversation = await prisma.communicationConversation.findFirst({
      where: {
        id: validated.conversationId,
        practiceId,
      },
      include: {
        patient: {
          select: {
            id: true,
            primaryPhone: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const channel = validated.channel || (conversation.channel as any)
    const adapter = getChannelAdapter(channel)
    const recipient = {
      phone: conversation.patient.primaryPhone || conversation.patient.phone,
      email: conversation.patient.email,
    }

    if (!adapter.validateRecipient(recipient)) {
      return NextResponse.json({ error: 'Invalid recipient for channel' }, { status: 400 })
    }

    const delivery = await adapter.sendMessage({
      practiceId,
      conversationId: conversation.id,
      patientId: conversation.patient.id,
      channel,
      body: validated.body,
      recipient,
      attachments: validated.attachments,
    })

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.communicationMessage.create({
        data: {
          practiceId,
          conversationId: conversation.id,
          patientId: conversation.patient.id,
          authorUserId: user.id,
          direction: 'outbound',
          type: 'message',
          body: validated.body,
          channel,
          deliveryStatus: delivery.status,
          metadata: delivery.metadata
            ? (delivery.metadata as Prisma.InputJsonValue)
            : undefined,
        },
      })

      if (validated.attachments?.length) {
        await tx.communicationAttachment.createMany({
          data: validated.attachments.map((attachment) => ({
            practiceId,
            messageId: created.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType || undefined,
            fileSize: attachment.fileSize || undefined,
            storageKey: attachment.storageKey,
            url: attachment.url || undefined,
          })),
        })
      }

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
          action: 'message_sent',
          resourceType: 'conversation',
          resourceId: conversation.id,
          changes: {
            messageId: created.id,
            channel,
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
      patientId: conversation.patient.id,
      messageId: message.id,
      channel,
      actorUserId: user.id,
    })

    return NextResponse.json({ data: { messageId: message.id } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    )
  }
}
