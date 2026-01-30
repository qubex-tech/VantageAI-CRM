import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/smart/crypto'
import { resolveSmartPractice } from '@/lib/integrations/smart/server'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { summarizeCapabilities } from '@/lib/integrations/fhir/capabilities'

const querySchema = z.object({
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
    const { practiceId, user } = await resolveSmartPractice(parsed.data.practiceId)

    const connection = await prisma.smartFhirConnection.findFirst({
      where: {
        practiceId,
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
        const client = new FhirClient({
          baseUrl: connection.fhirBaseUrl,
          tokenEndpoint: connection.tokenEndpoint || undefined,
          clientId: connection.clientId,
          tokenState: {
            accessToken: decryptString(connection.accessTokenEnc),
            refreshToken: connection.refreshTokenEnc
              ? decryptString(connection.refreshTokenEnc)
              : undefined,
            tokenType: connection.tokenType || undefined,
            expiresAt: connection.expiresAt,
            scopes: connection.scopes,
          },
          onTokenRefresh: async (tokenResponse) => {
            await prisma.smartFhirConnection.update({
              where: { id: connection.id },
              data: {
                accessTokenEnc: encryptString(tokenResponse.access_token),
                refreshTokenEnc: tokenResponse.refresh_token
                  ? encryptString(tokenResponse.refresh_token)
                  : connection.refreshTokenEnc,
                tokenType: tokenResponse.token_type || connection.tokenType,
                expiresAt: tokenResponse.expires_in
                  ? new Date(Date.now() + tokenResponse.expires_in * 1000)
                  : connection.expiresAt,
                scopes: tokenResponse.scope || connection.scopes,
              },
            })
            await prisma.integrationAuditLog.create({
              data: {
                tenantId: practiceId,
                actorUserId: user.id,
                action: 'SMART_TOKEN_REFRESH',
                entity: 'SmartFhirConnection',
                entityId: connection.id,
                metadata: {
                  issuer: connection.issuer,
                },
              },
            })
          },
        })
        const capabilityStatement = await client.getCapabilityStatement()
        capabilitiesSummary = summarizeCapabilities(capabilityStatement)
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('Token refresh failed') || message.includes('FHIR request failed: 401')) {
          await prisma.smartFhirConnection.update({
            where: { id: connection.id },
            data: { status: 'expired' },
          })
          await prisma.integrationAuditLog.create({
            data: {
              tenantId: practiceId,
              actorUserId: user.id,
              action: 'SMART_TOKEN_EXPIRED',
              entity: 'SmartFhirConnection',
              entityId: connection.id,
              metadata: { issuer: connection.issuer },
            },
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
      scopes: connection.scopes,
      expiresAt: connection.expiresAt,
      patientContext: connection.patientContext,
      userContext: connection.userContext,
      capabilitiesSummary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
