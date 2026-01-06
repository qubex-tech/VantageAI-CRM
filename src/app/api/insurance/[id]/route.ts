import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { insurancePolicySchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { emitEvent } from '@/lib/outbox'

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
      where: {
        id,
        practiceId: practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    const validated = insurancePolicySchema.partial().parse(body)

    const policy = await prisma.insurancePolicy.update({
      where: { id },
      data: validated,
    })

    await createAuditLog({
      practiceId: practiceId,
      userId: user.id,
      action: 'update',
      resourceType: 'insurance',
      resourceId: policy.id,
      changes: {
        before: existing,
        after: policy,
      },
    })

    // Emit event for automation
    await emitEvent({
      practiceId,
      eventName: 'crm/insurance.updated',
      entityType: 'insurance',
      entityId: policy.id,
      data: {
        insurance: {
          id: policy.id,
          patientId: policy.patientId,
          providerName: policy.providerName,
          planName: policy.planName,
          memberId: policy.memberId,
          eligibilityStatus: policy.eligibilityStatus,
        },
        changes: validated,
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
      where: {
        id,
        practiceId: practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    await prisma.insurancePolicy.delete({
      where: { id },
    })

    await createAuditLog({
      practiceId: practiceId,
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

