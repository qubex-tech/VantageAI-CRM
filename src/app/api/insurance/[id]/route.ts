import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { insurancePolicySchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const existing = await prisma.insurancePolicy.findFirst({
      where: {
        id: params.id,
        practiceId: user.practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    const validated = insurancePolicySchema.partial().parse(body)

    const policy = await prisma.insurancePolicy.update({
      where: { id: params.id },
      data: validated,
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'update',
      resourceType: 'insurance',
      resourceId: policy.id,
      changes: {
        before: existing,
        after: policy,
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
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req)

    const existing = await prisma.insurancePolicy.findFirst({
      where: {
        id: params.id,
        practiceId: user.practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    await prisma.insurancePolicy.delete({
      where: { id: params.id },
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'delete',
      resourceType: 'insurance',
      resourceId: params.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete insurance policy' },
      { status: 500 }
    )
  }
}

