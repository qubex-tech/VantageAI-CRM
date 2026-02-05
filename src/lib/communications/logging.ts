import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { CommunicationChannel } from './types'
import { generateConversationSummary } from './summaryService'

interface LogOutboundInput {
  practiceId: string
  patientId: string
  channel: CommunicationChannel
  body: string
  userId: string
  subject?: string | null
  metadata?: Record<string, unknown>
}

interface LogInboundInput {
  practiceId: string
  patientId: string
  channel: CommunicationChannel
  body: string
  subject?: string | null
  metadata?: Record<string, unknown>
}

export async function logOutboundCommunication({
  practiceId,
  patientId,
  channel,
  body,
  userId,
  subject,
  metadata,
}: LogOutboundInput) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.communicationConversation.findFirst({
      where: {
        practiceId,
        patientId,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const conversation =
      existing ||
      (await tx.communicationConversation.create({
        data: {
          practiceId,
          patientId,
          channel,
          status: 'open',
          subject: subject || undefined,
        },
      }))

    const message = await tx.communicationMessage.create({
      data: {
        practiceId,
        conversationId: conversation.id,
        patientId,
        authorUserId: userId,
        direction: 'outbound',
        type: 'message',
        body,
        channel,
        deliveryStatus: 'sent',
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    })

    await tx.communicationConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 140),
        subject: subject || conversation.subject || undefined,
        channel,
      },
    })

    await tx.auditLog.create({
      data: {
        practiceId,
        userId,
        action: 'message_sent',
        resourceType: 'conversation',
        resourceId: conversation.id,
        changes: {
          messageId: message.id,
          channel,
        } as Prisma.InputJsonValue,
      },
    })

    return { conversationId: conversation.id, messageId: message.id }
  })

  void generateConversationSummary({
    practiceId,
    conversationId: result.conversationId,
    actorUserId: userId,
  })

  return result
}

export async function logInboundCommunication({
  practiceId,
  patientId,
  channel,
  body,
  subject,
  metadata,
}: LogInboundInput) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.communicationConversation.findFirst({
      where: {
        practiceId,
        patientId,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const conversation =
      existing ||
      (await tx.communicationConversation.create({
        data: {
          practiceId,
          patientId,
          channel,
          status: 'open',
          subject: subject || undefined,
        },
      }))

    const message = await tx.communicationMessage.create({
      data: {
        practiceId,
        conversationId: conversation.id,
        patientId,
        direction: 'inbound',
        type: 'message',
        body,
        channel,
        deliveryStatus: 'delivered',
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    })

    await tx.communicationConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 140),
        subject: subject || conversation.subject || undefined,
        status: 'open',
        channel,
      },
    })

    const assignment = await tx.communicationAssignment.findFirst({
      where: {
        practiceId,
        conversationId: conversation.id,
        status: 'active',
        assignedUserId: { not: null },
      },
      orderBy: { assignedAt: 'desc' },
      select: { assignedUserId: true },
    })

    if (assignment?.assignedUserId) {
      await tx.auditLog.create({
        data: {
          practiceId,
          userId: assignment.assignedUserId,
          action: 'message_received',
          resourceType: 'conversation',
          resourceId: conversation.id,
          changes: {
            messageId: message.id,
            channel,
          } as Prisma.InputJsonValue,
        },
      })
    }

    return { conversationId: conversation.id, messageId: message.id }
  })

  void generateConversationSummary({
    practiceId,
    conversationId: result.conversationId,
  })

  return result
}
