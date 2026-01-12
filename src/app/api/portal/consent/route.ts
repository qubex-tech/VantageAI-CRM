import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { consentUpdateSchema } from '@/lib/validations'

/**
 * POST /api/portal/consent
 * Update patient consent
 */
export async function POST(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const body = await req.json()
    const parsed = consentUpdateSchema.parse(body)

    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    // Verify patient belongs to practice
    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
        practiceId: practiceContext.practiceId,
      },
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Create consent record
    const consent = await prisma.consentRecord.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        consentType: parsed.consentType,
        consented: parsed.consented,
        method: 'web',
        source: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        revokedAt: parsed.consented ? null : new Date(),
      },
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        action: 'consent_changed',
        resourceType: 'consent',
        resourceId: consent.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ consent })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update consent' },
      { status: 500 }
    )
  }
}
