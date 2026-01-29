import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { patientOTPRequestSchema } from '@/lib/validations'
import { createPatientOTP, verifyInviteTokenAnyPractice } from '@/lib/patient-auth'
import { patientNameMatches } from '@/lib/name-matching'
import { cookies } from 'next/headers'

function normalizeDigits(value: string) {
  return value.replace(/[^\d]/g, '')
}

/**
 * POST /api/portal/auth/otp
 * Request OTP for patient login
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

    let invite: Awaited<ReturnType<typeof verifyInviteTokenAnyPractice>>
    try {
      invite = await verifyInviteTokenAnyPractice(inviteToken)
    } catch (e) {
      console.error('[portal/auth/otp] verifyInviteTokenAnyPractice failed:', e)
      return NextResponse.json(
        { error: 'We could not verify your invite right now. Please try again in a moment.' },
        { status: 503 }
      )
    }
    if (!invite) {
      // Clear stale token
      cookieStore.delete('portal_invite')
      return NextResponse.json(
        { error: 'Invite link is invalid or expired. Please request a new invite from your practice.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = patientOTPRequestSchema.parse(body)

    if (!parsed.email && !parsed.phone) {
      return NextResponse.json(
        { error: 'Email or phone required' },
        { status: 400 }
      )
    }

    // Lock OTP issuance to the invited patient only (prevents guessing).
    const patient = await prisma.patient.findFirst({
      where: {
        id: invite.patientId,
        practiceId: invite.practiceId,
        deletedAt: null,
      },
    })

    if (!patient || !patientNameMatches(patient, parsed.fullName)) {
      // Don't reveal details (security)
      return NextResponse.json(
        { message: 'If an account exists, an OTP has been sent' },
        { status: 200 }
      )
    }

    const patientPracticeId = patient.practiceId

    const channel = parsed.email ? 'email' : 'sms'
    const recipient = parsed.email || parsed.phone!

    // Extra safety: only allow OTP to be sent to a contact already on the patient record.
    if (channel === 'email') {
      const patientEmail = patient.email?.trim().toLowerCase()
      if (!patientEmail || patientEmail !== parsed.email!.trim().toLowerCase()) {
        return NextResponse.json(
          { message: 'If an account exists, an OTP has been sent' },
          { status: 200 }
        )
      }
    } else {
      const enteredDigits = normalizeDigits(parsed.phone || '')
      const matchesAny =
        Boolean(enteredDigits) &&
        [patient.phone, patient.primaryPhone, patient.secondaryPhone]
          .filter(Boolean)
          .some((p) => normalizeDigits(String(p)).includes(enteredDigits) || enteredDigits.includes(normalizeDigits(String(p))))
      if (!matchesAny) {
        return NextResponse.json(
          { message: 'If an account exists, an OTP has been sent' },
          { status: 200 }
        )
      }
    }

    await createPatientOTP(
      patientPracticeId,
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
    if (error instanceof Error && error.message.includes('Contact information is already linked')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
