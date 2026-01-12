import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { appointmentCancelSchema } from '@/lib/validations'

/**
 * POST /api/portal/appointments/[id]/cancel
 * Cancel an appointment
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const { id: appointmentId } = await params
    const body = await req.json()
    const parsed = appointmentCancelSchema.parse(body)
    
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

    // Update appointment status
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'cancelled',
        notes: parsed.reason ? `${appointment.notes || ''}\nCancelled: ${parsed.reason}`.trim() : appointment.notes,
      },
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        action: 'appointment_cancelled',
        resourceType: 'appointment',
        resourceId: appointmentId,
        changes: { reason: parsed.reason },
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ appointment: updated })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel appointment' },
      { status: 500 }
    )
  }
}
