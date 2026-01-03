import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { insurancePolicySchema } from '@/lib/validations'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'

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

    const validated = insurancePolicySchema.parse(body)
    const { patientId } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    // Verify patient belongs to practice
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: practiceId,
        deletedAt: null,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const policy = await prisma.insurancePolicy.create({
      data: {
        ...validated,
        practiceId: practiceId,
        patientId,
      },
    })

    await createAuditLog({
      practiceId: practiceId,
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
      description: `${validated.providerName} - ${validated.memberId}`,
      metadata: { policyId: policy.id },
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

