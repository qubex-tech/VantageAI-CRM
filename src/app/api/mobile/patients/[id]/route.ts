import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

function displayName(p: {
  name: string
  firstName: string | null
  lastName: string | null
}): string {
  if (p.firstName && p.lastName) return `${p.firstName} ${p.lastName}`
  return p.name || 'Unknown'
}

/**
 * GET /api/mobile/patients/:id
 * Lean patient profile for the mobile Patients tab.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'No practice associated with this account' }, { status: 403 })
    }

    if (!rateLimit(`${user.id}:mobile-patient-detail`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { id } = await context.params

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        dateOfBirth: true,
        gender: true,
        primaryPhone: true,
        secondaryPhone: true,
        phone: true,
        email: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        address: true,
        insuranceStatus: true,
        selfPay: true,
        preferredChannel: true,
        doNotContact: true,
        notes: true,
        externalEhrId: true,
        tags: { select: { id: true, tag: true }, take: 20 },
        insurancePolicies: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            payerNameRaw: true,
            memberId: true,
            groupNumber: true,
            planName: true,
            isPrimary: true,
            eligibilityStatus: true,
          },
        },
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 8,
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
            visitType: true,
            reason: true,
            notes: true,
          },
        },
        patientNotes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            type: true,
            content: true,
            createdAt: true,
          },
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const addressParts = [
      patient.addressLine1,
      patient.addressLine2,
      [patient.city, patient.state].filter(Boolean).join(', '),
      patient.postalCode,
    ].filter((part) => Boolean(part && String(part).trim()))

    return NextResponse.json({
      patient: {
        id: patient.id,
        name: displayName(patient),
        firstName: patient.firstName,
        lastName: patient.lastName,
        preferredName: patient.preferredName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.primaryPhone || patient.phone || null,
        secondaryPhone: patient.secondaryPhone,
        email: patient.email,
        address: addressParts.length ? addressParts.join('\n') : patient.address,
        insuranceStatus: patient.insuranceStatus,
        selfPay: patient.selfPay,
        preferredChannel: patient.preferredChannel,
        doNotContact: patient.doNotContact,
        chartNotes: patient.notes,
        externalEhrId: patient.externalEhrId,
        tags: patient.tags.map((t) => ({ id: t.id, name: t.tag })),
        insurancePolicies: patient.insurancePolicies.map((policy) => ({
          id: policy.id,
          carrierName: policy.payerNameRaw,
          memberId: policy.memberId,
          groupNumber: policy.groupNumber,
          planName: policy.planName,
          isPrimary: policy.isPrimary,
          status: policy.eligibilityStatus,
        })),
        appointments: patient.appointments,
        notes: patient.patientNotes,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/patients/:id GET]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
