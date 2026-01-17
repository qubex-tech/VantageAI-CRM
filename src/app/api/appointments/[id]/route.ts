import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { appointmentSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { emitEvent } from '@/lib/outbox'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        practiceId: practiceId,
      },
      include: {
        patient: true,
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch appointment' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)
    const body = await req.json()

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const existing = await prisma.appointment.findFirst({
      where: {
        id,
        practiceId: practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const validated = appointmentSchema.partial().parse(body)

    const appointment = await prisma.appointment.update({
      where: { id },
      data: validated,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            phone: true,
            primaryPhone: true,
            secondaryPhone: true,
            email: true,
          },
        },
      },
    })

    await createAuditLog({
      practiceId: practiceId,
      userId: user.id,
      action: 'update',
      resourceType: 'appointment',
      resourceId: appointment.id,
      changes: {
        before: existing,
        after: appointment,
      },
    })

    // Emit event for automation - check if status changed to a specific status
    const statusChanged = validated.status && validated.status !== existing.status
    
    await emitEvent({
      practiceId,
      eventName: 'crm/appointment.updated',
      entityType: 'appointment',
      entityId: appointment.id,
      data: {
        appointment: {
          id: appointment.id,
          patientId: appointment.patientId,
          status: appointment.status,
          startTime: appointment.startTime.toISOString(),
          endTime: appointment.endTime.toISOString(),
          visitType: appointment.visitType,
        },
        patient: appointment.patient,
        changes: validated,
        userId: user.id,
      },
    })

    // Emit specific status events
    if (statusChanged) {
      if (validated.status === 'confirmed') {
        await emitEvent({
          practiceId,
          eventName: 'crm/appointment.confirmed',
          entityType: 'appointment',
          entityId: appointment.id,
          data: {
            appointment: {
              id: appointment.id,
              patientId: appointment.patientId,
              status: appointment.status,
              visitType: appointment.visitType,
            },
            patient: appointment.patient,
            userId: user.id,
          },
        })
      } else if (validated.status === 'completed') {
        await emitEvent({
          practiceId,
          eventName: 'crm/appointment.completed',
          entityType: 'appointment',
          entityId: appointment.id,
          data: {
            appointment: {
              id: appointment.id,
              patientId: appointment.patientId,
              status: appointment.status,
              visitType: appointment.visitType,
            },
            patient: appointment.patient,
            userId: user.id,
          },
        })
      } else if (validated.status === 'no_show') {
        await emitEvent({
          practiceId,
          eventName: 'crm/appointment.no_show',
          entityType: 'appointment',
          entityId: appointment.id,
          data: {
            appointment: {
              id: appointment.id,
              patientId: appointment.patientId,
              status: appointment.status,
              visitType: appointment.visitType,
            },
            patient: appointment.patient,
            userId: user.id,
          },
        })
      }
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update appointment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const existing = await prisma.appointment.findFirst({
      where: {
        id,
        practiceId: practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Update status to cancelled instead of deleting
    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            phone: true,
            primaryPhone: true,
            secondaryPhone: true,
            email: true,
          },
        },
      },
    })

    await createAuditLog({
      practiceId: practiceId,
      userId: user.id,
      action: 'delete',
      resourceType: 'appointment',
      resourceId: appointment.id,
    })

    // Emit event for automation
    await emitEvent({
      practiceId,
      eventName: 'crm/appointment.cancelled',
      entityType: 'appointment',
      entityId: appointment.id,
      data: {
        appointment: {
          id: appointment.id,
          patientId: appointment.patientId,
          status: appointment.status,
          startTime: appointment.startTime.toISOString(),
          endTime: appointment.endTime.toISOString(),
          visitType: appointment.visitType,
        },
        patient: appointment.patient,
        userId: user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel appointment' },
      { status: 500 }
    )
  }
}

