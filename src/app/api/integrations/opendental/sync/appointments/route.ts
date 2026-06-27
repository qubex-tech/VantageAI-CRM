import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'
import { syncOpenDentalAppointments } from '@/lib/integrations/opendental/appointmentSync'

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const syncSchema = z.object({
  practiceId: z.string().optional(),
  dateStart: z.string().regex(datePattern).optional(),
  dateEnd: z.string().regex(datePattern).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  maxPages: z.number().int().min(1).max(1000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = syncSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid sync payload' }, { status: 400 })
    }

    const { user, practiceId } = await resolveOpenDentalPractice(parsed.data.practiceId)

    const summary = await syncOpenDentalAppointments({
      practiceId,
      actorUserId: user.id,
      dateStart: parsed.data.dateStart,
      dateEnd: parsed.data.dateEnd,
      limit: parsed.data.limit,
      maxPages: parsed.data.maxPages,
    })

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Appointment sync failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
