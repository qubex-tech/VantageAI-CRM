import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPracticeContext } from '@/lib/tenant'
import { patientOTPVerifySchema } from '@/lib/validations'
import { verifyPatientOTP } from '@/lib/patient-auth'
import { cookies } from 'next/headers'
import { patientNameMatches } from '@/lib/name-matching'

/**
 * POST /api/portal/auth/verify
 * Verify OTP and create session
 */
export async function POST(req: NextRequest) {
  try {
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

    // Try to get practice context from domain (for subdomain routing)
    // If no practice found, we'll search across all practices
    const practiceContext = await getPracticeContext(req)
    
    // Build patient search query (by email or phone)
    const phoneDigits = phone ? phone.replace(/[^\d]/g, '') : ''
    const patientWhere: any = {
      OR: email
        ? [{ email }]
        : [
            { phone: { contains: phoneDigits } },
            { primaryPhone: { contains: phoneDigits } },
            { secondaryPhone: { contains: phoneDigits } },
          ],
    }

    // If we have a practice context from domain (subdomain routing), scope to that practice
    if (practiceContext) {
      patientWhere.practiceId = practiceContext.practiceId
    }

    // Find patients (may return multiple if family shares contact info)
    const patients = await prisma.patient.findMany({
      where: patientWhere,
      include: {
        patientAccount: true,
      },
    })

    // Filter by name match (flexible matching)
    const matchingPatient = patients.find(patient => 
      patientNameMatches(patient, fullName)
    )

    if (!matchingPatient || !matchingPatient.patientAccount) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 401 }
      )
    }

    const patient = matchingPatient

    // Use the patient's practiceId (found from patient record)
    const patientPracticeId = patient.practiceId

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
    const cookieStore = await cookies()
    const sessionToken = `${patient.id}:${patientPracticeId}:${Date.now()}`
    cookieStore.set('portal_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

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
