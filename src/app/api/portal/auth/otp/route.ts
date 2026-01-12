import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { patientOTPRequestSchema } from '@/lib/validations'
import { createPatientOTP } from '@/lib/patient-auth'

/**
 * POST /api/portal/auth/otp
 * Request OTP for patient login
 */
export async function POST(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const body = await req.json()
    const parsed = patientOTPRequestSchema.parse(body)

    if (!parsed.email && !parsed.phone) {
      return NextResponse.json(
        { error: 'Email or phone required' },
        { status: 400 }
      )
    }

    // Find patient by email or phone
    const patient = await prisma.patient.findFirst({
      where: {
        practiceId: practiceContext.practiceId,
        OR: parsed.email
          ? [{ email: parsed.email }]
          : [
              { phone: { contains: parsed.phone!.replace(/[^\d]/g, '') } },
              { primaryPhone: { contains: parsed.phone!.replace(/[^\d]/g, '') } },
              { secondaryPhone: { contains: parsed.phone!.replace(/[^\d]/g, '') } },
            ],
      },
    })

    if (!patient) {
      // Don't reveal if patient exists (security)
      return NextResponse.json(
        { message: 'If an account exists, an OTP has been sent' },
        { status: 200 }
      )
    }

    // Create or update patient account
    await prisma.patientAccount.upsert({
      where: { patientId: patient.id },
      create: {
        practiceId: practiceContext.practiceId,
        patientId: patient.id,
        email: parsed.email || null,
        phone: parsed.phone || null,
      },
      update: {
        email: parsed.email || undefined,
        phone: parsed.phone || undefined,
      },
    })

    // Generate and send OTP
    const channel = parsed.email ? 'email' : 'sms'
    const recipient = parsed.email || parsed.phone!
    await createPatientOTP(
      practiceContext.practiceId,
      patient.id,
      channel,
      recipient
    )

    // Return success (don't reveal if patient exists)
    return NextResponse.json({
      message: 'If an account exists, an OTP has been sent',
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
