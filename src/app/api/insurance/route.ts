import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { insurancePolicyFormSchema } from '@/lib/validations'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'
import { emitEvent } from '@/lib/outbox'

function mapBodyToPolicyData(body: Record<string, unknown>, practiceId: string, patientId: string) {
  const validated = insurancePolicyFormSchema.parse(body)
  return {
    practiceId,
    patientId,
    payerNameRaw: validated.payerNameRaw,
    memberId: validated.memberId,
    groupNumber: validated.groupNumber || null,
    planName: validated.planName || null,
    planType: validated.planType || null,
    isPrimary: validated.isPrimary,
    subscriberIsPatient: validated.subscriberIsPatient,
    subscriberFirstName: validated.subscriberIsPatient ? null : (validated.subscriberFirstName || null),
    subscriberLastName: validated.subscriberIsPatient ? null : (validated.subscriberLastName || null),
    subscriberDob: validated.subscriberIsPatient ? null : (validated.subscriberDob || null),
    relationshipToPatient: validated.subscriberIsPatient ? null : (validated.relationshipToPatient || null),
    bcbsAlphaPrefix: validated.bcbsAlphaPrefix || null,
    bcbsStatePlan: validated.bcbsStatePlan || null,
    rxBin: validated.rxBin || null,
    rxPcn: validated.rxPcn || null,
    rxGroup: validated.rxGroup || null,
    cardFrontRef: validated.cardFrontRef || null,
    cardBackRef: validated.cardBackRef || null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId
    const patientId = body.patientId as string

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId,
        deletedAt: null,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const data = mapBodyToPolicyData(body, practiceId, patientId)
    const policy = await prisma.insurancePolicy.create({ data })

    await createAuditLog({
      practiceId,
      userId: user.id,
      action: 'create',
      resourceType: 'insurance',
      resourceId: policy.id,
      changes: { after: policy },
    })

    await createTimelineEntry({
      patientId,
      type: 'insurance',
      title: 'Insurance policy added',
      description: `${policy.payerNameRaw} – Member ****${policy.memberId.slice(-4)}`,
      metadata: { policyId: policy.id },
    })

    await emitEvent({
      practiceId,
      eventName: 'crm/insurance.created',
      entityType: 'insurance',
      entityId: policy.id,
      data: {
        insurance: {
          id: policy.id,
          patientId: policy.patientId,
          payerNameRaw: policy.payerNameRaw,
          memberId: policy.memberId,
          isPrimary: policy.isPrimary,
        },
        userId: user.id,
      },
    })

    return NextResponse.json({ policy }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create insurance policy' },
      { status: 500 }
    )
  }
}
