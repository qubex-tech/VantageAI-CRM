import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePatientSession } from '@/lib/portal-session'
import { communicationPreferenceSchema } from '@/lib/validations'

/**
 * GET /api/portal/preferences
 * Get patient communication preferences
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientSession(req)
    const { patientId } = session

    const preferences = await prisma.communicationPreference.findUnique({
      where: {
        patientId,
      },
    })

    return NextResponse.json({ preferences: preferences || null })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/portal/preferences
 * Update patient communication preferences
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await requirePatientSession(req)
    const { patientId, practiceId } = session
    const body = await req.json()
    const parsed = communicationPreferenceSchema.parse(body)

    // Upsert preferences
    const preferences = await prisma.communicationPreference.upsert({
      where: {
        patientId,
      },
      create: {
        practiceId,
        patientId,
        preferredChannel: parsed.preferredChannel || 'email',
        smsEnabled: parsed.smsEnabled ?? true,
        emailEnabled: parsed.emailEnabled ?? true,
        voiceEnabled: parsed.voiceEnabled ?? false,
        portalEnabled: parsed.portalEnabled ?? true,
        quietHoursStart: parsed.quietHoursStart,
        quietHoursEnd: parsed.quietHoursEnd,
        frequencyCap: parsed.frequencyCap,
        frequencyPeriod: parsed.frequencyPeriod,
      },
      update: {
        preferredChannel: parsed.preferredChannel,
        smsEnabled: parsed.smsEnabled,
        emailEnabled: parsed.emailEnabled,
        voiceEnabled: parsed.voiceEnabled,
        portalEnabled: parsed.portalEnabled,
        quietHoursStart: parsed.quietHoursStart,
        quietHoursEnd: parsed.quietHoursEnd,
        frequencyCap: parsed.frequencyCap,
        frequencyPeriod: parsed.frequencyPeriod,
      },
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId,
        patientId,
        action: 'preference_updated',
        resourceType: 'communication_preference',
        resourceId: preferences.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ preferences })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
