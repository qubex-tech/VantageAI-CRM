import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { communicationStartSchema } from '@/lib/validations'
import { getChannelAdapter } from '@/lib/communications/adapters'
import type { DeliveryStatus } from '@/lib/communications/types'
import { getTwilioClient } from '@/lib/twilio'
import { getSendgridClient } from '@/lib/sendgrid'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  assignee: z.enum(['me', 'team', 'all']).optional(),
  channel: z.enum(['sms', 'email', 'secure', 'voice', 'video']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:conversations:list`, 120, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const params = req.nextUrl.searchParams
    const parsed = querySchema.safeParse({
      status: params.get('status') || undefined,
      assignee: params.get('assignee') || undefined,
      channel: params.get('channel') || undefined,
      search: params.get('search') || undefined,
      limit: params.get('limit') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const { status, assignee, channel, search, limit } = parsed.data
    const practiceId = user.practiceId

    const where: any = {
      practiceId,
    }

    if (status) {
      where.status = status
    }

    if (channel) {
      where.channel = channel
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' as const } },
        { lastMessagePreview: { contains: search, mode: 'insensitive' as const } },
        {
          patient: {
            name: { contains: search, mode: 'insensitive' as const },
          },
        },
      ]
    }

    if (assignee === 'me') {
      where.OR = [
        {
          assignments: {
            some: {
              status: 'active',
              assignedUserId: user.id,
            },
          },
        },
        {
          messages: {
            some: {
              authorUserId: user.id,
            },
          },
        },
      ]
    } else if (assignee === 'team') {
      const teamMemberships = await prisma.teamMember.findMany({
        where: {
          userId: user.id,
          team: { practiceId },
        },
        select: { teamId: true },
      })
      const teamIds = teamMemberships.map((membership) => membership.teamId)
      if (teamIds.length === 0) {
        return NextResponse.json({ data: { conversations: [] } })
      }
      // Team view shows all practice conversations.
    }

    const conversations = await prisma.communicationConversation.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            preferredName: true,
          },
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 1,
          include: {
            assignedUser: {
              select: { id: true, name: true },
            },
            assignedTeam: {
              select: { id: true, name: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            direction: true,
            readAt: true,
          },
        },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit ?? 100,
    })

    const shaped = conversations.map((conversation) => {
      const latestAssignment = conversation.assignments[0]
      const latestMessage = conversation.messages[0]
      const unread =
        latestMessage?.direction === 'inbound' && !latestMessage.readAt

      return {
        id: conversation.id,
        status: conversation.status,
        channel: conversation.channel,
        subject: conversation.subject,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        updatedAt: conversation.updatedAt,
        patient: {
          id: conversation.patient.id,
          name: conversation.patient.preferredName || conversation.patient.name,
        },
        assignee: latestAssignment?.assignedUser
          ? { type: 'user', ...latestAssignment.assignedUser }
          : latestAssignment?.assignedTeam
            ? { type: 'team', ...latestAssignment.assignedTeam }
            : null,
        unread,
      }
    })

    return NextResponse.json({ data: { conversations: shaped } })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:conversations:start`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const validated = communicationStartSchema.parse(body)
    const practiceId = user.practiceId

    const patient = await prisma.patient.findFirst({
      where: {
        id: validated.patientId,
        practiceId,
        deletedAt: null,
      },
      select: {
        id: true,
        primaryPhone: true,
        phone: true,
        email: true,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const recipient = {
      phone: patient.primaryPhone || patient.phone,
      email: patient.email,
    }

    let delivery: { status: DeliveryStatus; metadata?: Record<string, unknown> } = {
      status: 'sent',
      metadata: undefined,
    }
    if (validated.channel === 'sms') {
      if (!recipient.phone) {
        return NextResponse.json({ error: 'Patient phone is required for SMS' }, { status: 400 })
      }
      const twilioClient = await getTwilioClient(practiceId)
      const result = await twilioClient.sendSms({
        to: recipient.phone,
        body: validated.body,
      })
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send SMS via Twilio' },
          { status: 500 }
        )
      }
      delivery = {
        status: 'sent',
        metadata: { providerMessageId: result.messageId },
      }
    } else if (validated.channel === 'email') {
      if (!recipient.email) {
        return NextResponse.json({ error: 'Patient email is required for email' }, { status: 400 })
      }
      const sendgridClient = await getSendgridClient(practiceId)
      const result = await sendgridClient.sendEmail({
        to: recipient.email,
        subject: validated.subject || 'Message from your care team',
        textContent: validated.body,
      })
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send email via SendGrid' },
          { status: 500 }
        )
      }
      delivery = {
        status: 'sent',
        metadata: { providerMessageId: result.messageId },
      }
    } else {
      const adapter = getChannelAdapter(validated.channel)
      if (!adapter.validateRecipient(recipient)) {
        return NextResponse.json({ error: 'Invalid recipient for channel' }, { status: 400 })
      }
      const result = await adapter.sendMessage({
        practiceId,
        conversationId: '',
        patientId: patient.id,
        channel: validated.channel,
        body: validated.body,
        recipient,
      })
      delivery = {
        status: result.status,
        metadata: result.metadata,
      }
    }

    const { conversationId, messageId } = await prisma.$transaction(async (tx) => {
      const existing = await tx.communicationConversation.findFirst({
        where: {
          practiceId,
          patientId: patient.id,
          channel: validated.channel,
          status: { in: ['open', 'pending'] },
        },
        orderBy: { updatedAt: 'desc' },
      })

      const conversation =
        existing ||
        (await tx.communicationConversation.create({
          data: {
            practiceId,
            patientId: patient.id,
            channel: validated.channel,
            status: 'open',
            subject: validated.subject || undefined,
          },
        }))

      const message = await tx.communicationMessage.create({
        data: {
          practiceId,
          conversationId: conversation.id,
          patientId: patient.id,
          authorUserId: user.id,
          direction: 'outbound',
          type: 'message',
          body: validated.body,
          channel: validated.channel,
          deliveryStatus: delivery.status,
        },
      })

      await tx.communicationConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: validated.body.slice(0, 140),
          subject: validated.subject || conversation.subject || undefined,
          channel: validated.channel,
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
            messageId: message.id,
            channel: validated.channel,
          },
        },
      })

      return { conversationId: conversation.id, messageId: message.id }
    })

    return NextResponse.json({ data: { conversationId, messageId } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error starting conversation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start conversation' },
      { status: 500 }
    )
  }
}
