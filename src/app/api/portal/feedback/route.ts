import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { feedbackSchema } from '@/lib/validations'

/**
 * POST /api/portal/feedback
 * Submit feedback (NPS/CSAT/Review)
 */
export async function POST(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const body = await req.json()
    const parsed = feedbackSchema.parse(body)
    
    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    // Verify patient belongs to practice
    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
        practiceId: practiceContext.practiceId,
      },
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        reviewRequestId: parsed.reviewRequestId || null,
        type: parsed.type,
        score: parsed.score || null,
        comment: parsed.comment || null,
        isPublic: parsed.type === 'review' && (parsed.score || 0) >= 4, // Auto-public for positive reviews
      },
    })

    // If review request exists, mark as completed
    if (parsed.reviewRequestId) {
      await prisma.reviewRequest.update({
        where: { id: parsed.reviewRequestId },
        data: { completedAt: new Date() },
      })
    }

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        action: 'feedback_submitted',
        resourceType: 'feedback',
        resourceId: feedback.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
