import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { appointmentSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
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

    const existing = await prisma.appointment.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
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
            phone: true,
            email: true,
          },
        },
      },
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'update',
      resourceType: 'appointment',
      resourceId: appointment.id,
      changes: {
        before: existing,
        after: appointment,
      },
    })

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

    const existing = await prisma.appointment.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Update status to cancelled instead of deleting
    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'delete',
      resourceType: 'appointment',
      resourceId: appointment.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel appointment' },
      { status: 500 }
    )
  }
}

