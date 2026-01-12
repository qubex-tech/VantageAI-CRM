import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { patientOTPVerifySchema } from '@/lib/validations'
import { verifyPatientOTP } from '@/lib/patient-auth'
import { cookies } from 'next/headers'

/**
 * POST /api/portal/auth/verify
 * Verify OTP and create session
 */
export async function POST(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const body = await req.json()
    const parsed = patientOTPVerifySchema.parse(body)
    const { code } = parsed

    // Get patient identifier from request
    const email = body.email as string | undefined
    const phone = body.phone as string | undefined

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone required' },
        { status: 400 }
      )
    }

    // Find patient
    const patient = await prisma.patient.findFirst({
      where: {
        practiceId: practiceContext.practiceId,
        OR: email
          ? [{ email }]
          : [
              { phone: { contains: phone!.replace(/[^\d]/g, '') } },
              { primaryPhone: { contains: phone!.replace(/[^\d]/g, '') } },
              { secondaryPhone: { contains: phone!.replace(/[^\d]/g, '') } },
            ],
      },
      include: {
        patientAccount: true,
      },
    })

    if (!patient || !patient.patientAccount) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 401 }
      )
    }

    // Verify OTP
    const isValid = await verifyPatientOTP(
      practiceContext.practiceId,
      patient.id,
      code
    )

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 401 }
      )
    }

    // Create session (simple cookie-based for now)
    // In production, use JWT or secure session management
    const cookieStore = await cookies()
    const sessionToken = `${patient.id}:${practiceContext.practiceId}:${Date.now()}`
    cookieStore.set('portal_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId: patient.id,
        action: 'login',
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({
      patient: {
        id: patient.id,
        email: patient.email,
        phone: patient.phone,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
