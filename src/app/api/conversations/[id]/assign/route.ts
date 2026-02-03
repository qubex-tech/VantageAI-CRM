import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { communicationAssignmentSchema } from '@/lib/validations'
import { emitCommunicationEvent } from '@/lib/communications/events'
import { ensureCommunicationRuntime } from '@/lib/communications/runtime'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }
    const practiceId = user.practiceId

    if (!rateLimit(`${user.id}:conversations:assign`, 80, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const validated = communicationAssignmentSchema.parse(body)

    const conversation = await prisma.communicationConversation.findFirst({
      where: {
        id: params.id,
        practiceId,
      },
      select: { id: true, patientId: true, status: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (validated.assigneeType === 'user') {
      const assignee = await prisma.user.findFirst({
        where: { id: validated.assigneeId, practiceId },
        select: { id: true },
      })
      if (!assignee) {
        return NextResponse.json({ error: 'Assignee not found' }, { status: 404 })
      }
    }

    if (validated.assigneeType === 'team') {
      const team = await prisma.team.findFirst({
        where: { id: validated.assigneeId, practiceId },
        select: { id: true },
      })
      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 })
      }
    }

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.communicationAssignment.updateMany({
        where: {
          practiceId,
          conversationId: conversation.id,
          status: 'active',
        },
        data: {
          status: 'resolved',
        },
      })

      const created = await tx.communicationAssignment.create({
        data: {
          practiceId,
          conversationId: conversation.id,
          assignedUserId: validated.assigneeType === 'user' ? validated.assigneeId : undefined,
          assignedTeamId: validated.assigneeType === 'team' ? validated.assigneeId : undefined,
          status: validated.status ?? 'active',
          assignedByUserId: user.id,
        },
      })

      if (conversation.status !== 'resolved') {
        await tx.communicationConversation.update({
          where: { id: conversation.id },
          data: { status: 'pending' },
        })
      }

      await tx.auditLog.create({
        data: {
          practiceId,
          userId: user.id,
          action: 'assign',
          resourceType: 'conversation',
          resourceId: conversation.id,
          changes: {
            assignmentId: created.id,
            assigneeType: validated.assigneeType,
            assigneeId: validated.assigneeId,
          },
        },
      })

      return created
    })

    ensureCommunicationRuntime()
    await emitCommunicationEvent({
      type: 'conversation.assigned',
      practiceId,
      conversationId: conversation.id,
      patientId: conversation.patientId,
      assignmentId: assignment.id,
      actorUserId: user.id,
    })

    return NextResponse.json({ data: { assignmentId: assignment.id } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error assigning conversation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign conversation' },
      { status: 500 }
    )
  }
}
