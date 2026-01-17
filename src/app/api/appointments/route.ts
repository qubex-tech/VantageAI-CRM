import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { appointmentSchema, bookAppointmentSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { getCalClient } from '@/lib/cal'
import { bookAppointment as bookAppointmentAction } from '@/lib/agentActions'
import { emitEvent } from '@/lib/outbox'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId
    
    const searchParams = req.nextUrl.searchParams
    const date = searchParams.get('date')
    const status = searchParams.get('status')
    const patientId = searchParams.get('patientId')

    const where: any = {
      practiceId: practiceId,
    }

    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      }
    }

    if (status) {
      where.status = status
    }

    if (patientId) {
      where.patientId = patientId
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId
    
    const body = await req.json()

    // Check if this is a booking request (with Cal.com integration)
    if (body.eventTypeId && body.startTime) {
      const bookingParams = bookAppointmentSchema.parse(body)
      
      const result = await bookAppointmentAction(
        practiceId,
        bookingParams.patientId,
        bookingParams.eventTypeId,
        bookingParams.startTime,
        bookingParams.timezone || 'America/New_York',
        bookingParams.reason
      )

      // Get the created appointment
      const appointment = await prisma.appointment.findUnique({
        where: { id: result.appointmentId },
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

      if (!appointment) {
        return NextResponse.json(
          { error: 'Appointment created but could not be retrieved' },
          { status: 500 }
        )
      }

      await createAuditLog({
        practiceId: practiceId,
        userId: user.id,
        action: 'create',
        resourceType: 'appointment',
        resourceId: result.appointmentId,
        changes: { after: appointment },
      })

      // Emit event for automation
      await emitEvent({
        practiceId,
        eventName: 'crm/appointment.created',
        entityType: 'appointment',
        entityId: result.appointmentId,
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

      return NextResponse.json({ appointment, booking: result }, { status: 201 })
    }

    // Regular appointment creation (without Cal.com)
    const validated = appointmentSchema.parse(body)

    const appointment = await prisma.appointment.create({
      data: {
        ...validated,
        practiceId: practiceId,
      },
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
      action: 'create',
      resourceType: 'appointment',
      resourceId: appointment.id,
      changes: { after: appointment },
    })

    // Emit event for automation
    await emitEvent({
      practiceId,
      eventName: 'crm/appointment.created',
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

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create appointment' },
      { status: 500 }
    )
  }
}

