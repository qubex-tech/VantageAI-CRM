import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { preVisitChartQuestionSchema } from '@/lib/validations'
import { buildPatientEvidenceBundle } from '@/lib/previsit/evidence'
import { answerPreVisitQuestion } from '@/lib/previsit/generate'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const body = await req.json()
    const payload = preVisitChartQuestionSchema.parse(body)

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    let conversationId = payload.conversationId || null
    if (conversationId) {
      const existingConversation = await prisma.healixConversation.findFirst({
        where: {
          id: conversationId,
          practiceId: user.practiceId,
          userId: user.id,
        },
        select: { id: true },
      })
      if (!existingConversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
    } else {
      const conversation = await prisma.healixConversation.create({
        data: {
          practiceId: user.practiceId,
          userId: user.id,
        },
      })
      conversationId = conversation.id
    }

    const evidenceBundle = await buildPatientEvidenceBundle({
      practiceId: user.practiceId,
      patientId,
    })

    const answer = await answerPreVisitQuestion({
      question: payload.question,
      evidenceItems: evidenceBundle.evidenceItems,
    })

    await prisma.healixMessage.createMany({
      data: [
        {
          conversationId,
          role: 'user',
          content: { text: payload.question, patientId } as Prisma.InputJsonValue,
        },
        {
          conversationId,
          role: 'assistant',
          content: {
            answer: answer.answer,
            references: answer.references,
          } as unknown as Prisma.InputJsonValue,
        },
      ],
    })

    await prisma.healixConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'view',
      resourceType: 'patient',
      resourceId: patientId,
      changes: {
        after: {
          action: 'previsit_question_answered',
          question: payload.question,
          conversationId,
        },
      },
    })

    await prisma.healixActionLog.create({
      data: {
        practiceId: user.practiceId,
        userId: user.id,
        conversationId,
        actionType: 'previsit_question_answered',
        toolName: 'answerPreVisitQuestion',
        toolArgs: {
          patientId,
          question: payload.question,
        },
        toolResult: {
          referenceCount: answer.references.length,
        },
      },
    })

    return NextResponse.json({
      conversationId,
      answer: answer.answer,
      references: answer.references,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to answer question' },
      { status: 500 }
    )
  }
}
