import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { projectGlassesCards } from '@/lib/glasses/cards'
import { demoGlassesPayload } from '@/lib/glasses/demo-chart'
import {
  healthcareAddendumRequiredBody,
  isGlassesDemoPatient,
  isHealthcareAddendumSigned,
} from '@/lib/glasses/healthcare-gate'
import { GlassesPatientNotFound, loadGlassesChartInput } from '@/lib/glasses/load'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/mobile/patients/:id/glasses
 * Three glance cards for Meta Ray-Ban Display. Real charts are refused until
 * GLASSES_HEALTHCARE_ADDENDUM=true. `demo` (or ?demo=1) returns a fictional chart
 * and does not read the patient row.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'No practice associated with this account' }, { status: 403 })
    }
    if (!rateLimit(`${user.id}:mobile-glasses`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { id } = await context.params
    const demo =
      isGlassesDemoPatient(id) || req.nextUrl.searchParams.get('demo') === '1'
    if (demo) {
      const payload = demoGlassesPayload()
      return NextResponse.json({
        mode: payload.mode,
        phiAllowed: payload.phiAllowed,
        patientLabel: payload.patientLabel,
        cards: payload.cards,
        notice: payload.notice,
      })
    }

    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid patient id' }, { status: 400 })
    }
    if (!isHealthcareAddendumSigned()) {
      return NextResponse.json(healthcareAddendumRequiredBody(), { status: 403 })
    }

    const appointmentId = req.nextUrl.searchParams.get('appointmentId')
    const appointment = z.string().uuid().safeParse(appointmentId)
    const input = await loadGlassesChartInput({
      practiceId: user.practiceId,
      patientId: parsed.data,
      appointmentId: appointment.success ? appointment.data : null,
    })
    const cards = projectGlassesCards(input)
    return NextResponse.json({
      mode: 'phi',
      phiAllowed: true,
      patientLabel: input.patientName,
      cards,
      notice: 'Chart is on the glasses. End the session before you leave the room.',
    })
  } catch (err: unknown) {
    if (err instanceof GlassesPatientNotFound) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
