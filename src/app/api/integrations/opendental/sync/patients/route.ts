import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'
import { syncOpenDentalPatients } from '@/lib/integrations/opendental/patientSync'

const syncSchema = z.object({
  practiceId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  maxPages: z.number().int().min(1).max(1000).optional(),
  since: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = syncSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid sync payload' }, { status: 400 })
    }

    const { user, practiceId } = await resolveOpenDentalPractice(parsed.data.practiceId)

    const summary = await syncOpenDentalPatients({
      practiceId,
      actorUserId: user.id,
      limit: parsed.data.limit,
      maxPages: parsed.data.maxPages,
      since: parsed.data.since,
    })

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Patient sync failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
