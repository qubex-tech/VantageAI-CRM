import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice, getEhrSettings } from '@/lib/integrations/ehr/server'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import {
  fetchFacgcdPractitionerDirectoryForPractice,
  type FacgcdPractitionerDirectoryEntry,
} from '@/lib/integrations/ehr/scheduleSync'

const WRITEBACK_PROVIDER_ID = 'ecw_write'

const querySchema = z.object({
  practiceId: z.string().optional(),
  timeoutMs: z.coerce.number().min(5000).max(300000).optional(),
  maxPractitionerPages: z.coerce.number().min(1).max(2000).optional(),
  maxRolePages: z.coerce.number().min(1).max(10000).optional(),
  summary: z.enum(['1', 'true']).optional(),
})

function toSummaryEntry(entry: FacgcdPractitionerDirectoryEntry) {
  return {
    reference: entry.reference,
    practitionerId: entry.practitionerId,
    formattedName: entry.formattedName,
    practitionerRoleIds: entry.practitionerRoleIds,
    organizationReferences: entry.organizationReferences,
    locationReferences: entry.locationReferences,
  }
}

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
        { error: 'ecw_write provider must be enabled to load practitioners via backend connection' },
        { status: 403 }
      )
    }

    const directory = await fetchFacgcdPractitionerDirectoryForPractice(practiceId, {
      timeoutMs: parsed.data.timeoutMs,
      maxPractitionerPages: parsed.data.maxPractitionerPages,
      maxRolePages: parsed.data.maxRolePages,
    })

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'EHR_TEST_PRACTITIONERS_DIRECTORY_READ',
      providerId: WRITEBACK_PROVIDER_ID,
      entity: 'Practitioner',
      metadata: {
        summary: Boolean(parsed.data.summary),
        found: Boolean(directory),
        practitionerCount: directory?.practitionerCount,
        practitionerRoleCount: directory?.practitionerRoleCount,
      },
    })

    if (!directory) {
      return NextResponse.json(
        { error: 'No backend write connection or practitioner directory could not be loaded' },
        { status: 404 }
      )
    }

    const summary = Boolean(parsed.data.summary)
    const body = summary
      ? {
          issuer: directory.issuer,
          practitionerInitialPath: directory.practitionerInitialPath,
          practitionerPagesScanned: directory.practitionerPagesScanned,
          practitionerRolePagesScanned: directory.practitionerRolePagesScanned,
          practitionerCount: directory.practitionerCount,
          practitionerRoleCount: directory.practitionerRoleCount,
          entries: directory.entries.map(toSummaryEntry),
        }
      : directory

    return NextResponse.json(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load practitioner directory'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
