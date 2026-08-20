import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { insurancePolicyFormSchema } from '@/lib/validations'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'
import { emitEvent } from '@/lib/outbox'
import { normalizePhoneForDialing } from '@/lib/phone'
import {
  getPracticeEligibilitySettings,
  upsertPayerIdMap,
} from '@/lib/eligibility/clearinghouse'

async function mapBodyToPolicyData(
  body: Record<string, unknown>,
  practiceId: string,
  patientId: string,
  existing?: { availityPayerId?: string | null; clearinghousePayerIds?: unknown } | null
) {
  const validated = insurancePolicyFormSchema.parse(body)
  const settings = await getPracticeEligibilitySettings(practiceId)
  let payerMap = upsertPayerIdMap(
    existing?.clearinghousePayerIds,
    'availity',
    existing?.availityPayerId
  )
  if (validated.availityPayerId !== undefined) {
    payerMap = upsertPayerIdMap(payerMap, 'availity', validated.availityPayerId || null)
  }
  const clearinghousePayerId =
    validated.clearinghousePayerId ??
    (settings.primaryVendorKey === 'availity' ? validated.availityPayerId : undefined)
  if (clearinghousePayerId !== undefined) {
    payerMap = upsertPayerIdMap(payerMap, settings.primaryVendorKey, clearinghousePayerId || null)
  }

  return {
    practiceId,
    patientId,
    payerNameRaw: validated.payerNameRaw,
    insurerPhoneRaw: validated.insurerPhone || null,
    insurerPhoneNormalized: normalizePhoneForDialing(validated.insurerPhone),
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
    availityPayerId: payerMap.availity || null,
    clearinghousePayerIds: payerMap,
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

    const data = await mapBodyToPolicyData(body, practiceId, patientId)
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
