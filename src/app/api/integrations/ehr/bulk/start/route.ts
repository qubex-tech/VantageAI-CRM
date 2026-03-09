import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resolveEhrPractice, getEhrSettings } from '@/lib/integrations/ehr/server'
import { getProvider } from '@/lib/integrations/ehr/providers'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

const bodySchema = z.object({
  providerId: z.string(),
  practiceId: z.string().optional(),
  groupId: z.string().min(1),
  type: z.string().optional(),
  since: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
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
    if (!settings?.enableBulkExport) {
      return NextResponse.json({ error: 'Bulk export disabled' }, { status: 403 })
    }
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }

    const provider = getProvider(parsed.data.providerId as any)
    if (!provider.supportsBulkExport) {
      return NextResponse.json({ error: 'Provider does not support bulk export' }, { status: 400 })
    }

    const connections = await prisma.ehrConnection.findMany({
      where: {
        tenantId: practiceId,
        providerId: parsed.data.providerId,
      },
      orderBy: { updatedAt: 'desc' },
    })
    const connection = connections.find((candidate) => candidate.authFlow === 'backend_services')
    if (!connection?.accessTokenEnc) {
      return NextResponse.json(
        { error: 'No backend services connection. Use backend connect endpoint.' },
        { status: 409 }
      )
    }

    const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
    const accessToken = decryptString(refreshedConnection.accessTokenEnc!)

    const baseUrl = refreshedConnection.fhirBaseUrl.replace(/\/+$/g, '')
    const params = new URLSearchParams()
    if (parsed.data.type) {
      params.set('_type', parsed.data.type)
    }
    if (parsed.data.since) {
      params.set('_since', parsed.data.since)
    }
    const exportUrl = `${baseUrl}/Group/${parsed.data.groupId}/$export${
      params.toString() ? `?${params.toString()}` : ''
    }`

    const response = await fetch(exportUrl, {
      method: 'GET',
      headers: {
        accept: 'application/fhir+json',
        prefer: 'respond-async',
        authorization: `Bearer ${accessToken}`,
      },
    })

    const responseText = await response.text()
    if (!response.ok) {
      return NextResponse.json(
        { error: `Bulk export start failed: ${responseText}` },
        { status: response.status }
      )
    }

    const contentLocation = response.headers.get('content-location')
    const retryAfter = response.headers.get('retry-after')

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'EHR_BULK_EXPORT_START',
      providerId: refreshedConnection.providerId,
      entity: 'EhrConnection',
      entityId: refreshedConnection.id,
      metadata: {
        groupId: parsed.data.groupId,
        exportUrl,
        contentLocation,
        retryAfter,
      },
    })

    return NextResponse.json({
      status: 'accepted',
      contentLocation,
      retryAfter,
      response: responseText || undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start bulk export'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
