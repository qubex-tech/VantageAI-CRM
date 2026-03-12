import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resolveEhrPractice, getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { supportsResourceInteraction } from '@/lib/integrations/fhir/capabilities'

const bodySchema = z.object({
  providerId: z.string(),
  issuer: z.string().url().optional(),
  practiceId: z.string().optional(),
  bundle: z
    .object({
      resourceType: z.literal('Bundle'),
      type: z.string().optional(),
      entry: z.array(z.any()).optional(),
    })
    .passthrough(),
  skipCapabilityCheck: z.boolean().optional(),
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
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }
    if (!settings?.enableWrite) {
      return NextResponse.json(
        { error: 'Patient update is disabled. Enable write access for this tenant.' },
        { status: 403 }
      )
    }

    const connections = await prisma.ehrConnection.findMany({
      where: {
        tenantId: practiceId,
        providerId: parsed.data.providerId,
        issuer: parsed.data.issuer || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    })
    const expectedAuthFlow = isApiKeyAuth ? 'backend_services' : 'smart_launch'
    const connection = connections.find((candidate) => candidate.authFlow === expectedAuthFlow)

    if (!connection?.accessTokenEnc) {
      if (connections.length > 0 && expectedAuthFlow === 'smart_launch') {
        return NextResponse.json(
          { error: 'SMART App Launch connection required. Use standalone connect.' },
          { status: 409 }
        )
      }
      if (expectedAuthFlow === 'backend_services') {
        return NextResponse.json(
          { error: 'No backend services connection. Use backend connect endpoint.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'No active EHR connection' }, { status: 404 })
    }

    const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
    const tokenEndpoint = refreshedConnection.tokenEndpoint || undefined
    const privateKeyConfig = tokenEndpoint ? getPrivateKeyJwtConfig(connection.providerId) : null
    const audOverride = connection.providerId.startsWith('ecw')
      ? process.env.EHR_ECW_CLIENT_ASSERTION_AUD || undefined
      : undefined
    const client = new FhirClient({
      baseUrl: refreshedConnection.fhirBaseUrl,
      tokenEndpoint,
      clientId: refreshedConnection.clientId,
      clientSecret:
        !privateKeyConfig && refreshedConnection.clientSecretEnc
          ? decryptString(refreshedConnection.clientSecretEnc)
          : undefined,
      clientAssertionProvider: privateKeyConfig && tokenEndpoint
        ? () =>
            createClientAssertion({
              clientId: refreshedConnection.clientId,
              tokenEndpoint,
              privateKeyPem: privateKeyConfig.privateKeyPem,
              keyId: privateKeyConfig.keyId,
              audience: audOverride,
            })
        : undefined,
      tokenState: {
        accessToken: decryptString(refreshedConnection.accessTokenEnc!),
        refreshToken: refreshedConnection.refreshTokenEnc
          ? decryptString(refreshedConnection.refreshTokenEnc)
          : undefined,
        tokenType: undefined,
        expiresAt: refreshedConnection.expiresAt,
        scopes: refreshedConnection.scopesGranted || undefined,
      },
      onTokenRefresh: async (tokenResponse) => {
        await prisma.ehrConnection.update({
          where: { id: refreshedConnection.id },
          data: {
            accessTokenEnc: encryptString(tokenResponse.access_token),
            refreshTokenEnc: tokenResponse.refresh_token
              ? encryptString(tokenResponse.refresh_token)
              : refreshedConnection.refreshTokenEnc,
            expiresAt: tokenResponse.expires_in
              ? new Date(Date.now() + tokenResponse.expires_in * 1000)
              : refreshedConnection.expiresAt,
            scopesGranted: tokenResponse.scope || refreshedConnection.scopesGranted,
          },
        })
        await logEhrAudit({
          tenantId: practiceId,
          actorUserId: isApiKeyAuth ? null : user.id,
          action: 'EHR_TOKEN_REFRESH',
          providerId: connection.providerId,
          entity: 'EhrConnection',
          entityId: connection.id,
        })
      },
    })

    if (!parsed.data.skipCapabilityCheck) {
      const capabilityStatement = await client.getCapabilityStatement()
      if (!supportsResourceInteraction(capabilityStatement, 'Patient', 'update')) {
        return NextResponse.json(
          { error: 'Patient update not supported' },
          { status: 409 }
        )
      }
    }

    const updated = await client.request('/', {
      method: 'POST',
      body: JSON.stringify(parsed.data.bundle),
    })

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'FHIR_WRITE',
      providerId: connection.providerId,
      entity: 'Patient',
      metadata: {
        issuer: connection.issuer,
      },
    })

    return NextResponse.json({ patient: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update patient'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
