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

    if (!rateLimit(`${user.id}:conversations:detail`, 180, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const conversation = await prisma.communicationConversation.findFirst({
      where: {
        id: params.id,
        practiceId: user.practiceId,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            preferredName: true,
            primaryPhone: true,
            phone: true,
            email: true,
          },
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 1,
          include: {
            assignedUser: { select: { id: true, name: true } },
            assignedTeam: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const latestAssignment = conversation.assignments[0]

    return NextResponse.json({
      data: {
        conversation: {
          id: conversation.id,
          status: conversation.status,
          channel: conversation.channel,
          subject: conversation.subject,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          patient: {
            id: conversation.patient.id,
            name: conversation.patient.preferredName || conversation.patient.name,
            primaryPhone: conversation.patient.primaryPhone || conversation.patient.phone,
            email: conversation.patient.email,
          },
          assignee: latestAssignment?.assignedUser
            ? { type: 'user', ...latestAssignment.assignedUser }
            : latestAssignment?.assignedTeam
              ? { type: 'team', ...latestAssignment.assignedTeam }
              : null,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}
