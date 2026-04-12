import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice, getEhrSettings } from '@/lib/integrations/ehr/server'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { fetchEhrPractitionerRolesOnlyForPractice } from '@/lib/integrations/ehr/scheduleSync'

const WRITEBACK_PROVIDER_ID = 'ecw_write'

const querySchema = z.object({
  practiceId: z.string().optional(),
  ref: z.string().min(3, 'ref is required (e.g. Practitioner/<id> or raw id)'),
  timeoutMs: z.coerce.number().min(5000).max(120000).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 })
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
    if (!settings?.enabledProviders?.includes(WRITEBACK_PROVIDER_ID as any)) {
      return NextResponse.json(
        { error: 'ecw_write provider must be enabled to load practitioner roles via backend connection' },
        { status: 403 }
      )
    }

    const result = await fetchEhrPractitionerRolesOnlyForPractice(practiceId, parsed.data.ref, {
      timeoutMs: parsed.data.timeoutMs,
    })

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'EHR_TEST_PRACTITIONER_ROLE_READ',
      providerId: WRITEBACK_PROVIDER_ID,
      entity: 'PractitionerRole',
      metadata: {
        reference: parsed.data.ref,
        found: Boolean(result),
        roleCount: result?.roles.length ?? 0,
        pagesScanned: result?.pagesScanned,
      },
    })

    if (!result) {
      return NextResponse.json(
        {
          error: 'Practitioner not found or no backend write connection',
          hint: 'Resolves Practitioner via GET /Practitioner?_id=… then pages GET /PractitionerRole and filters by practitioner reference.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load practitioner roles'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
