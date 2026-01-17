import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { patientSchema } from '@/lib/validations'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'
import { tenantScope } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId
    
    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '50')

    const patients = await prisma.patient.findMany({
      where: {
        practiceId: practiceId,
        deletedAt: null,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { primaryPhone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ]
          : undefined,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tags: true,
        _count: {
          select: {
            appointments: true,
            insurancePolicies: true,
          },
        },
      },
    })

    return NextResponse.json({ patients })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch patients' },
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
    const practiceId = user.practiceId
    
    const body = await req.json()

    const validated = patientSchema.parse(body)

    // Ensure required fields are set for patient creation
    // Construct name from firstName/lastName if name is not provided
    const patientName = validated.name || 
      (validated.firstName && validated.lastName 
        ? `${validated.firstName} ${validated.lastName}`.trim() 
        : validated.firstName || validated.lastName || '')
    
    // Ensure phone is set (use primaryPhone if phone is not provided)
    const patientPhone = validated.phone || validated.primaryPhone || ''
    
    // Ensure preferredContactMethod is set
    const patientPreferredContactMethod = validated.preferredContactMethod || validated.preferredChannel || 'phone'

    if (!patientName) {
      return NextResponse.json(
        { error: 'Name or firstName/lastName is required' },
        { status: 400 }
      )
    }

    if (!patientPhone) {
      return NextResponse.json(
        { error: 'Phone or primaryPhone is required' },
        { status: 400 }
      )
    }

    // Prepare patient data for creation - ensure all required fields are set
    const patientData = {
      name: patientName,
      phone: patientPhone,
      preferredContactMethod: patientPreferredContactMethod as 'phone' | 'email' | 'sms' | 'mail',
      practiceId: practiceId,
      // Basic Information
      externalEhrId: validated.externalEhrId ?? null,
      firstName: validated.firstName ?? null,
      lastName: validated.lastName ?? null,
      preferredName: validated.preferredName ?? null,
      dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
      // Contact Information
      primaryPhone: validated.primaryPhone || patientPhone || null,
      secondaryPhone: validated.secondaryPhone ?? null,
      email: validated.email || null,
      addressLine1: validated.addressLine1 ?? null,
      addressLine2: validated.addressLine2 ?? null,
      address: validated.address ?? null,
      city: validated.city ?? null,
      state: validated.state ?? null,
      postalCode: validated.postalCode ?? null,
      gender: validated.gender ? (validated.gender as 'male' | 'female' | 'other' | 'unknown') : null,
      pronouns: validated.pronouns ?? null,
      primaryLanguage: validated.primaryLanguage ?? null,
      // Communication Preferences & Consent
      preferredChannel: validated.preferredChannel ? (validated.preferredChannel as 'sms' | 'email' | 'voice') : null,
      smsOptIn: validated.smsOptIn ?? false,
      smsOptInAt: validated.smsOptInAt ? new Date(validated.smsOptInAt) : null,
      emailOptIn: validated.emailOptIn ?? false,
      voiceOptIn: validated.voiceOptIn ?? false,
      doNotContact: validated.doNotContact ?? false,
      quietHoursStart: validated.quietHoursStart ?? null,
      quietHoursEnd: validated.quietHoursEnd ?? null,
      consentSource: validated.consentSource ? (validated.consentSource as 'web' | 'voice' | 'staff' | 'import') : null,
      // Insurance Summary
      primaryInsuranceId: validated.primaryInsuranceId ?? null,
      secondaryInsuranceId: validated.secondaryInsuranceId ?? null,
      insuranceStatus: validated.insuranceStatus ? (validated.insuranceStatus as 'verified' | 'missing' | 'expired' | 'self_pay') : null,
      lastInsuranceVerifiedAt: validated.lastInsuranceVerifiedAt ? new Date(validated.lastInsuranceVerifiedAt) : null,
      selfPay: validated.selfPay ?? false,
      // Legacy
      notes: validated.notes ?? null,
    }

    // Handle tags separately
    const tags = validated.tags
      ? {
          create: validated.tags.map((tag) => ({ tag })),
        }
      : undefined

    const patient = await prisma.patient.create({
      data: {
        ...patientData,
        tags,
      },
      include: {
        tags: true,
      },
    })

    await createAuditLog({
      practiceId: practiceId,
      userId: user.id,
      action: 'create',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: { after: patient },
    })

    // Log patient creation activity
    const { logCustomActivity } = await import('@/lib/patient-activity')
    await logCustomActivity({
      patientId: patient.id,
      type: 'note',
      title: 'Patient created',
      description: 'Patient record was created',
      userId: user.id,
    })

    // Emit event for automation
    await emitEvent({
      practiceId,
      eventName: 'crm/patient.created',
      entityType: 'patient',
      entityId: patient.id,
      data: {
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          preferredContactMethod: patient.preferredContactMethod,
        },
        userId: user.id,
      },
    })

    return NextResponse.json({ patient }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create patient' },
      { status: 500 }
    )
  }
}

