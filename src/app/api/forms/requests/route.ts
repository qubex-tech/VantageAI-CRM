import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { emitEvent } from '@/lib/outbox'
import { getVerifiedFormRequestPortalUrl } from '@/lib/patient-auth'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const requests = await prisma.formRequest.findMany({
      where: { practiceId: user.practiceId },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        patient: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        },
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { patientId, formTemplateId, dueDate, message } = body

    if (!patientId || !formTemplateId) {
      return NextResponse.json(
        { error: 'Patient ID and template ID are required' },
        { status: 400 }
      )
    }

    const request = await prisma.formRequest.create({
      data: {
        practiceId: user.practiceId,
        patientId,
        formTemplateId,
        dueDate: dueDate ? new Date(dueDate) : null,
        metadata: message ? { message } : undefined,
        createdByUserId: user.id,
      },
      include: {
        template: true,
      },
    })

    await prisma.patientTask.create({
      data: {
        practiceId: user.practiceId,
        patientId,
        type: 'form_completion',
        title: `Complete ${request.template.name}`,
        description: message || 'Please complete this form at your earliest convenience.',
        status: 'pending',
        dueDate: dueDate ? new Date(dueDate) : null,
        metadata: {
          formRequestId: request.id,
          formTemplateId: request.formTemplateId,
        },
      },
    })

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        phone: true,
        primaryPhone: true,
        secondaryPhone: true,
      },
    })

    const portalLink = await getVerifiedFormRequestPortalUrl({
      practiceId: user.practiceId,
      patientId,
      formRequestId: request.id,
    })

    await emitEvent({
      practiceId: user.practiceId,
      eventName: 'crm/form_request.created',
      entityType: 'form_request',
      entityId: request.id,
      data: {
        patientId,
        patient,
        formRequest: {
          id: request.id,
          status: request.status,
          dueDate: request.dueDate,
          templateId: request.formTemplateId,
        },
        links: {
          formRequest: portalLink.url,
        },
      },
    })

    return NextResponse.json({ request }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create request' },
      { status: 500 }
    )
  }
}
