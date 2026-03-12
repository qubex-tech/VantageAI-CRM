import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resolveEhrPractice } from '@/lib/integrations/ehr/server'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

const querySchema = z.object({
  providerId: z.string(),
  practiceId: z.string().optional(),
  statusUrl: z.string().url(),
})

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
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

    const response = await fetch(parsed.data.statusUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
    })
    const responseText = await response.text()

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'EHR_BULK_EXPORT_STATUS',
      providerId: refreshedConnection.providerId,
      entity: 'EhrConnection',
      entityId: refreshedConnection.id,
      metadata: {
        statusUrl: parsed.data.statusUrl,
        status: response.status,
      },
    })

    if (response.status === 202) {
      return NextResponse.json({
        status: 'in_progress',
        retryAfter: response.headers.get('retry-after'),
        progress: response.headers.get('x-progress'),
      })
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: `Bulk export status failed: ${responseText}` },
        { status: response.status }
      )
    }
    return NextResponse.json({
      status: 'complete',
      body: responseText ? JSON.parse(responseText) : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check bulk export'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
