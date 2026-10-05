import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { answerGlassesQuestion } from '@/lib/glasses/ask'
import { snippetsForAsk, projectGlassesCards } from '@/lib/glasses/cards'
import { demoGlassesPayload } from '@/lib/glasses/demo-chart'
import {
  healthcareAddendumRequiredBody,
  isGlassesDemoPatient,
  isHealthcareAddendumSigned,
} from '@/lib/glasses/healthcare-gate'
import { GlassesPatientNotFound, loadGlassesChartInput } from '@/lib/glasses/load'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  question: z.string().trim().min(1).max(240),
})

/**
 * POST /api/mobile/patients/:id/glasses/ask
 * One-line answer from the chart already loaded for the glasses. Muse is refused
 * until the healthcare addendum is signed.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'No practice associated with this account' }, { status: 403 })
    }
    if (!rateLimit(`${user.id}:mobile-glasses-ask`, 30, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { id } = await context.params
    const demo =
      isGlassesDemoPatient(id) || req.nextUrl.searchParams.get('demo') === '1'
    const json = await req.json().catch(() => null)
    const parsedBody = bodySchema.safeParse(json)
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Ask a short chart question.' }, { status: 400 })
    }

    if (!demo) {
      const parsedId = z.string().uuid().safeParse(id)
      if (!parsedId.success) {
        return NextResponse.json({ error: 'Invalid patient id' }, { status: 400 })
      }
      if (!isHealthcareAddendumSigned()) {
        return NextResponse.json(healthcareAddendumRequiredBody(), { status: 403 })
      }
    }

    const snippets = demo
      ? demoGlassesPayload().snippets
      : await loadSnippets(user.practiceId, id)

    const result = await answerGlassesQuestion({
      question: parsedBody.data.question,
      snippets,
      demo,
    })
    return NextResponse.json({
      answer: result.answer,
      model: result.model,
      ...(result.modelBlocked ? { modelBlocked: result.modelBlocked } : {}),
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

async function loadSnippets(practiceId: string, patientId: string) {
  const input = await loadGlassesChartInput({ practiceId, patientId })
  return snippetsForAsk(input, projectGlassesCards(input))
}
