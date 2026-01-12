import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { appointmentRescheduleRequestSchema } from '@/lib/validations'

/**
 * POST /api/portal/appointments/[id]/reschedule-request
 * Request appointment reschedule
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const { id: appointmentId } = await params
    const body = await req.json()
    const parsed = appointmentRescheduleRequestSchema.parse(body)
    
    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    // Verify appointment belongs to patient
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        practiceId: practiceContext.practiceId,
        patientId,
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Create reschedule request (store in notes or separate table)
    // For now, we'll update notes and create a task
    const task = await prisma.patientTask.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        type: 'other',
        title: 'Reschedule Request',
        description: `Request to reschedule appointment from ${appointment.startTime.toISOString()} to ${parsed.requestedStartTime.toISOString()}. ${parsed.reason || ''}`,
        status: 'pending',
        metadata: {
          appointmentId,
          requestedStartTime: parsed.requestedStartTime,
          reason: parsed.reason,
        },
      },
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        action: 'appointment_reschedule_requested',
        resourceType: 'appointment',
        resourceId: appointmentId,
        changes: {
          requestedStartTime: parsed.requestedStartTime,
          reason: parsed.reason,
        },
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request reschedule' },
      { status: 500 }
    )
  }
}
