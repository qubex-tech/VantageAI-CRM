import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { insurancePolicyFormSchemaPartial } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { emitEvent } from '@/lib/outbox'

function mapBodyToUpdateData(body: Record<string, unknown>) {
  const validated = insurancePolicyFormSchemaPartial.parse(body)
  const data: Record<string, unknown> = {}
  if (validated.payerNameRaw !== undefined) data.payerNameRaw = validated.payerNameRaw
  if (validated.memberId !== undefined) data.memberId = validated.memberId
  if (validated.groupNumber !== undefined) data.groupNumber = validated.groupNumber || null
  if (validated.planName !== undefined) data.planName = validated.planName || null
  if (validated.planType !== undefined) data.planType = validated.planType || null
  if (validated.isPrimary !== undefined) data.isPrimary = validated.isPrimary
  if (validated.subscriberIsPatient !== undefined) data.subscriberIsPatient = validated.subscriberIsPatient
  if (validated.subscriberFirstName !== undefined) data.subscriberFirstName = validated.subscriberIsPatient ? null : (validated.subscriberFirstName || null)
  if (validated.subscriberLastName !== undefined) data.subscriberLastName = validated.subscriberIsPatient ? null : (validated.subscriberLastName || null)
  if (validated.subscriberDob !== undefined) data.subscriberDob = validated.subscriberIsPatient ? null : (validated.subscriberDob || null)
  if (validated.relationshipToPatient !== undefined) data.relationshipToPatient = validated.subscriberIsPatient ? null : (validated.relationshipToPatient || null)
  if (validated.bcbsAlphaPrefix !== undefined) data.bcbsAlphaPrefix = validated.bcbsAlphaPrefix || null
  if (validated.bcbsStatePlan !== undefined) data.bcbsStatePlan = validated.bcbsStatePlan || null
  if (validated.rxBin !== undefined) data.rxBin = validated.rxBin || null
  if (validated.rxPcn !== undefined) data.rxPcn = validated.rxPcn || null
  if (validated.rxGroup !== undefined) data.rxGroup = validated.rxGroup || null
  if (validated.cardFrontRef !== undefined) data.cardFrontRef = validated.cardFrontRef || null
  if (validated.cardBackRef !== undefined) data.cardBackRef = validated.cardBackRef || null
  return data
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)
    const body = await req.json()

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const existing = await prisma.insurancePolicy.findFirst({
      where: { id, practiceId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    const data = mapBodyToUpdateData(body)
    const policy = await prisma.insurancePolicy.update({
      where: { id },
      data,
    })

    await createAuditLog({
      practiceId,
      userId: user.id,
      action: 'update',
      resourceType: 'insurance',
      resourceId: policy.id,
      changes: { before: existing, after: policy },
    })

    await emitEvent({
      practiceId,
      eventName: 'crm/insurance.updated',
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
        changes: data,
        userId: user.id,
      },
    })

    return NextResponse.json({ policy })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update insurance policy' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const existing = await prisma.insurancePolicy.findFirst({
      where: { id, practiceId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    await prisma.insurancePolicy.delete({ where: { id } })

    await createAuditLog({
      practiceId,
      userId: user.id,
      action: 'delete',
      resourceType: 'insurance',
      resourceId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete insurance policy' },
      { status: 500 }
    )
  }
}
