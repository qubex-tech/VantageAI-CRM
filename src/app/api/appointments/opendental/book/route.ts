import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { createAuditLog } from '@/lib/audit'
import { emitEvent } from '@/lib/outbox'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import {
  bookOpenDentalAppointment,
  DEFAULT_SLOT_LENGTH_MINUTES,
} from '@/lib/integrations/opendental/scheduling'

export const dynamic = 'force-dynamic'

const bookSchema = z.object({
  patientId: z.string().min(1),
  dateTimeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/),
  provNum: z.number().int().positive().nullish(),
  opNum: z.number().int().positive().nullish(),
  lengthMinutes: z.number().int().positive().max(600).nullish(),
  note: z.string().max(2000).nullish(),
  visitType: z.string().max(200).nullish(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }
    const practiceId = user.practiceId

    const parsed = bookSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid booking request', details: parsed.error.flatten() }, { status: 400 })
    }
    const input = parsed.data

    const scheduling = await getSchedulingSettings(practiceId)
    const opNum = input.opNum || scheduling.defaultOperatoryNum || undefined
    const provNum = input.provNum || scheduling.defaultProvNum || undefined
    const lengthMinutes =
      input.lengthMinutes || scheduling.defaultLengthMinutes || DEFAULT_SLOT_LENGTH_MINUTES

    if (!opNum) {
      return NextResponse.json(
        { error: 'No operatory selected and no default operatory configured for this practice.' },
        { status: 400 }
      )
    }

    const result = await bookOpenDentalAppointment({
      practiceId,
      patientId: input.patientId,
      provNum,
      opNum,
      dateTimeStart: input.dateTimeStart.replace('T', ' '),
      lengthMinutes,
      note: input.note ?? undefined,
      visitType: input.visitType ?? undefined,
      actorUserId: user.id,
    })

    const appointment = await prisma.appointment.findUnique({
      where: { id: result.appointmentId },
      include: {
        patient: {
          select: { id: true, name: true, firstName: true, lastName: true, phone: true, email: true },
        },
      },
    })

    await createAuditLog({
      practiceId,
      userId: user.id,
      action: 'create',
      resourceType: 'appointment',
      resourceId: result.appointmentId,
      changes: { after: appointment },
    })

    if (appointment) {
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
    }

    return NextResponse.json({ appointment, aptNum: result.aptNum }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to book Open Dental appointment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
