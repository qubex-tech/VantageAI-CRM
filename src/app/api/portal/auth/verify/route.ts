import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { patientOTPVerifySchema } from '@/lib/validations'
import { verifyInviteTokenAnyPractice, verifyPatientOTP } from '@/lib/patient-auth'
import { cookies } from 'next/headers'
import { patientNameMatches } from '@/lib/name-matching'

function normalizeDigits(value: string) {
  return value.replace(/[^\d]/g, '')
}

/**
 * POST /api/portal/auth/verify
 * Verify OTP and create session
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const inviteToken = cookieStore.get('portal_invite')?.value
    if (!inviteToken) {
      return NextResponse.json(
        { error: 'Secure invite required. Please use the invite link your practice sent you.' },
        { status: 403 }
      )
    }

    const invite = await verifyInviteTokenAnyPractice(inviteToken)
    if (!invite) {
      cookieStore.delete('portal_invite')
      return NextResponse.json(
        { error: 'Invite link is invalid or expired. Please request a new invite from your practice.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = patientOTPVerifySchema.parse(body)
    const { code, fullName } = parsed

    // Get patient identifier from request
    const email = parsed.email
    const phone = parsed.phone

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone required' },
        { status: 400 }
      )
    }

    // Lock verification to invited patient only.
    const patient = await prisma.patient.findFirst({
      where: {
        id: invite.patientId,
        practiceId: invite.practiceId,
        deletedAt: null,
      },
      include: {
        patientAccount: true,
      },
    })

    if (!patient || !patient.patientAccount || !patientNameMatches(patient, fullName)) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 401 }
      )
    }

    const patientPracticeId = patient.practiceId

    // Extra safety: ensure the identifier matches the patient record.
    if (email) {
      const patientEmail = patient.email?.trim().toLowerCase()
      if (!patientEmail || patientEmail !== email.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
      }
    }
    if (phone) {
      const enteredDigits = normalizeDigits(phone)
      const matchesAny =
        Boolean(enteredDigits) &&
        [patient.phone, patient.primaryPhone, patient.secondaryPhone]
          .filter(Boolean)
          .some((p) => normalizeDigits(String(p)).includes(enteredDigits) || enteredDigits.includes(normalizeDigits(String(p))))
      if (!matchesAny) {
        return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
      }
    }

    // Verify OTP
    const isValid = await verifyPatientOTP(
      patientPracticeId,
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
    const sessionToken = `${patient.id}:${patientPracticeId}:${Date.now()}`
    cookieStore.set('portal_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    cookieStore.delete('portal_invite')

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: patientPracticeId,
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
