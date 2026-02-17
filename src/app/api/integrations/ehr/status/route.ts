import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { resolveEhrPractice, getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { summarizeCapabilities } from '@/lib/integrations/fhir/capabilities'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'

const querySchema = z.object({
  providerId: z.string(),
  issuer: z.string().url().optional(),
  includeCapabilities: z.string().optional(),
  practiceId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }
    const { practiceId, user } = await resolveEhrPractice(parsed.data.practiceId)
    const settings = await getEhrSettings(practiceId)
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }

    const connection = await prisma.ehrConnection.findFirst({
      where: {
        tenantId: practiceId,
        providerId: parsed.data.providerId,
        issuer: parsed.data.issuer || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    let capabilitiesSummary = undefined
    if (parsed.data.includeCapabilities === '1') {
      if (!connection.accessTokenEnc) {
        return NextResponse.json({ error: 'Connection missing access token' }, { status: 409 })
      }
      try {
        const tokenEndpoint = connection.tokenEndpoint || undefined
        const privateKeyConfig = tokenEndpoint ? getPrivateKeyJwtConfig(connection.providerId) : null
        const client = new FhirClient({
          baseUrl: connection.fhirBaseUrl,
          tokenEndpoint,
          clientId: connection.clientId,
          clientSecret:
            !privateKeyConfig && connection.clientSecretEnc
              ? decryptString(connection.clientSecretEnc)
              : undefined,
          clientAssertionProvider: privateKeyConfig && tokenEndpoint
            ? () =>
                createClientAssertion({
                  clientId: connection.clientId,
                  tokenEndpoint,
                  privateKeyPem: privateKeyConfig.privateKeyPem,
                  keyId: privateKeyConfig.keyId,
                })
            : undefined,
          tokenState: {
            accessToken: decryptString(connection.accessTokenEnc),
            refreshToken: connection.refreshTokenEnc
              ? decryptString(connection.refreshTokenEnc)
              : undefined,
            tokenType: undefined,
            expiresAt: connection.expiresAt,
            scopes: connection.scopesGranted || undefined,
          },
          onTokenRefresh: async (tokenResponse) => {
            await prisma.ehrConnection.update({
              where: { id: connection.id },
              data: {
                accessTokenEnc: encryptString(tokenResponse.access_token),
                refreshTokenEnc: tokenResponse.refresh_token
                  ? encryptString(tokenResponse.refresh_token)
                  : connection.refreshTokenEnc,
                expiresAt: tokenResponse.expires_in
                  ? new Date(Date.now() + tokenResponse.expires_in * 1000)
                  : connection.expiresAt,
                scopesGranted: tokenResponse.scope || connection.scopesGranted,
              },
            })
            await logEhrAudit({
              tenantId: practiceId,
              actorUserId: user.id,
              action: 'EHR_TOKEN_REFRESH',
              providerId: connection.providerId,
              entity: 'EhrConnection',
              entityId: connection.id,
            })
          },
        })
        const capabilityStatement = await client.getCapabilityStatement()
        capabilitiesSummary = summarizeCapabilities(capabilityStatement)
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('Token refresh failed') || message.includes('FHIR request failed: 401')) {
          await prisma.ehrConnection.update({
            where: { id: connection.id },
            data: { status: 'expired' },
          })
          await logEhrAudit({
            tenantId: practiceId,
            actorUserId: user.id,
            action: 'EHR_TOKEN_EXPIRED',
            providerId: connection.providerId,
            entity: 'EhrConnection',
            entityId: connection.id,
          })
        }
        capabilitiesSummary = { error: 'Failed to fetch capability statement' }
      }
    }

    return NextResponse.json({
      connected: true,
      status: connection.status,
      issuer: connection.issuer,
      fhirBaseUrl: connection.fhirBaseUrl,
      scopes: connection.scopesGranted,
      expiresAt: connection.expiresAt,
      idTokenClaimsSummary: connection.idTokenClaimsSummary,
      capabilitiesSummary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
