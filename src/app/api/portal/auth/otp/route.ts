import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPracticeContext } from '@/lib/tenant'
import { patientOTPRequestSchema } from '@/lib/validations'
import { createPatientOTP } from '@/lib/patient-auth'
import { patientNameMatches } from '@/lib/name-matching'

/**
 * POST /api/portal/auth/otp
 * Request OTP for patient login
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = patientOTPRequestSchema.parse(body)

    if (!parsed.email && !parsed.phone) {
      return NextResponse.json(
        { error: 'Email or phone required' },
        { status: 400 }
      )
    }

    // Try to get practice context from domain (for subdomain routing)
    // If no practice found, we'll search across all practices
    const practiceContext = await getPracticeContext(req)
    
    // Build patient search query (by email or phone)
    const phoneDigits = parsed.phone ? parsed.phone.replace(/[^\d]/g, '') : ''
    const patientWhere: any = {
      OR: parsed.email
        ? [{ email: parsed.email }]
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

    // Find patients by email or phone (may return multiple if family shares contact info)
    const patients = await prisma.patient.findMany({
      where: patientWhere,
      include: {
        practice: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    // Filter by name match (flexible matching)
    const matchingPatient = patients.find(patient => 
      patientNameMatches(patient, parsed.fullName)
    )

    if (!matchingPatient) {
      // Don't reveal if patient exists (security)
      return NextResponse.json(
        { message: 'If an account exists, an OTP has been sent' },
        { status: 200 }
      )
    }

    const patient = matchingPatient

    // Use the patient's practiceId (found from patient record)
    const patientPracticeId = patient.practiceId

    // Create or update patient account
    await prisma.patientAccount.upsert({
      where: { patientId: patient.id },
      create: {
        practiceId: patientPracticeId,
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
