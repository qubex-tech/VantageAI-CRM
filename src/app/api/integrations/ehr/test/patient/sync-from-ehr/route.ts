import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice, getEhrSettings } from '@/lib/integrations/ehr/server'
import { syncPatientDemographicsFromEhr } from '@/lib/integrations/ehr/patientUpdate'

const bodySchema = z.object({
  practiceId: z.string().optional(),
  patientId: z.string().uuid(),
  ehrPatientId: z.string().min(1).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const backendApiKey = process.env.EHR_BACKEND_API_KEY
    const isApiKeyAuth =
      backendApiKey &&
      apiKey &&
      (apiKey === backendApiKey || apiKey === `Bearer ${backendApiKey}`)

    if (isApiKeyAuth && !parsed.data.practiceId) {
      return NextResponse.json({ error: 'practiceId is required for API key auth' }, { status: 400 })
    }

    const authContext = isApiKeyAuth
      ? { practiceId: parsed.data.practiceId!, user: { id: 'system' } }
      : await resolveEhrPractice(parsed.data.practiceId)

    const { practiceId, user } = authContext
    const settings = await getEhrSettings(practiceId)
    if (!settings?.enabledProviders?.includes('ecw_write' as any)) {
      return NextResponse.json({ error: 'ecw_write not enabled for tenant' }, { status: 403 })
    }

    const result = await syncPatientDemographicsFromEhr({
      practiceId,
      patientId: parsed.data.patientId,
      ehrPatientId: parsed.data.ehrPatientId,
      actorUserId: user.id,
    })

    if (result.status === 'skipped') {
      return NextResponse.json(result, { status: 422 })
    }
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'sync failed'
    console.error('[sync-from-ehr]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
