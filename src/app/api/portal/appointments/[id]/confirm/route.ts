import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePatientSession } from '@/lib/portal-session'

/**
 * POST /api/portal/appointments/[id]/confirm
 * Confirm an appointment
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePatientSession(req)
    const { patientId, practiceId } = session
    const { id: appointmentId } = await params

    // Verify appointment belongs to patient
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        practiceId,
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
      data: { status: 'confirmed' },
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId,
        patientId,
        action: 'appointment_confirmed',
        resourceType: 'appointment',
        resourceId: appointmentId,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ appointment: updated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm appointment' },
      { status: 500 }
    )
  }
}
