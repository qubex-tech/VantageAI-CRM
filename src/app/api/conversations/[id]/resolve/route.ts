import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { communicationResolveSchema } from '@/lib/validations'
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

    if (!rateLimit(`${user.id}:conversations:resolve`, 80, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const validated = communicationResolveSchema.parse(body)

    const conversation = await prisma.communicationConversation.findFirst({
      where: {
        id: params.id,
        practiceId,
      },
      select: { id: true, patientId: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.communicationConversation.update({
        where: { id: conversation.id },
        data: { status: validated.status },
      })

      await tx.communicationAssignment.updateMany({
        where: {
          practiceId,
          conversationId: conversation.id,
          status: 'active',
        },
        data: { status: 'resolved' },
      })

      await tx.auditLog.create({
        data: {
          practiceId,
          userId: user.id,
          action: 'resolve',
          resourceType: 'conversation',
          resourceId: conversation.id,
          changes: {
            status: validated.status,
          },
        },
      })
    })

    ensureCommunicationRuntime()
    await emitCommunicationEvent({
      type: 'conversation.resolved',
      practiceId,
      conversationId: conversation.id,
      patientId: conversation.patientId,
      actorUserId: user.id,
    })

    return NextResponse.json({ data: { status: validated.status } })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error resolving conversation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve conversation' },
      { status: 500 }
    )
  }
}
