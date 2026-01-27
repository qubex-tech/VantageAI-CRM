import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const patientId = req.headers.get('x-patient-id')

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    const request = await prisma.formRequest.findFirst({
      where: {
        id: context.params.id,
        practiceId: practiceContext.practiceId,
        patientId,
      },
      include: {
        template: true,
        submission: true,
      },
    })

    if (!request) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    return NextResponse.json({ request })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch form' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const patientId = req.headers.get('x-patient-id')

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { formData } = body

    if (!formData) {
      return NextResponse.json({ error: 'Form data is required' }, { status: 400 })
    }

    const request = await prisma.formRequest.findFirst({
      where: {
        id: context.params.id,
        practiceId: practiceContext.practiceId,
        patientId,
      },
      include: {
        template: true,
        submission: true,
      },
    })

    if (!request) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    if (request.submission) {
      return NextResponse.json({ error: 'Form already submitted' }, { status: 409 })
    }

    const submission = await prisma.formSubmission.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        formTemplateId: request.formTemplateId,
        formRequestId: request.id,
        formType: request.template.category || 'custom',
        formData,
        status: 'submitted',
      },
    })

    await prisma.formRequest.update({
      where: { id: request.id },
      data: {
        status: 'submitted',
        completedAt: new Date(),
      },
    })

    await prisma.patientTask.updateMany({
      where: {
        practiceId: practiceContext.practiceId,
        patientId,
        metadata: {
          path: ['formRequestId'],
          equals: request.id,
        },
      },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })

    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        action: 'form_submitted',
        resourceType: 'form_request',
        resourceId: request.id,
        changes: { submissionId: submission.id },
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit form' },
      { status: 500 }
    )
  }
}
