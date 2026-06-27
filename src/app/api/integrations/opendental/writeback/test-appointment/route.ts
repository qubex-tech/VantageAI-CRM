import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'
import { writeTestAppointment } from '@/lib/integrations/opendental/appointmentWriteback'

const schema = z.object({
  practiceId: z.string().optional(),
  patNum: z.number().int().positive(),
  note: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'A valid patNum is required' }, { status: 400 })
    }

    const { user, practiceId } = await resolveOpenDentalPractice(parsed.data.practiceId)

    const result = await writeTestAppointment({
      practiceId,
      patNum: parsed.data.patNum,
      note: parsed.data.note,
      actorUserId: user.id,
    })

    return NextResponse.json({
      ok: result.writeback.status === 'success',
      writeback: result.writeback,
      appointmentId: result.appointmentId,
      startTime: result.startTime,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test appointment writeback failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
