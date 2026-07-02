import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { syncOpenDentalAppointmentByCrmId } from '@/lib/integrations/opendental/appointmentSync'

export const dynamic = 'force-dynamic'

export async function POST(
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

    if (id.startsWith('cal-')) {
      return NextResponse.json(
        { error: 'Cal.com-only bookings must be opened from the detail page to refresh.' },
        { status: 400 }
      )
    }

    const result = await syncOpenDentalAppointmentByCrmId({
      practiceId: user.practiceId,
      appointmentId: id,
      actorUserId: user.id,
    })

    const appointment = await prisma.appointment.findFirst({
      where: { id, practiceId: user.practiceId },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            primaryPhone: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ result, appointment })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pull appointment from Open Dental' },
      { status: 500 }
    )
  }
}
