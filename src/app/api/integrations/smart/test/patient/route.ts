import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/smart/crypto'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { resolveSmartPractice } from '@/lib/integrations/smart/server'

const querySchema = z.object({
  patientId: z.string().min(1),
  issuer: z.string().url().optional(),
  practiceId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { practiceId, user } = await resolveSmartPractice(parsed.data.practiceId)
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing patientId' }, { status: 400 })
    }

    const connection = await prisma.smartFhirConnection.findFirst({
      where: {
        practiceId,
        issuer: parsed.data.issuer || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!connection?.accessTokenEnc) {
      return NextResponse.json({ error: 'No active SMART connection' }, { status: 404 })
    }

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

    let patient
    try {
      patient = await client.getPatient(parsed.data.patientId)
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
        return NextResponse.json(
          { error: 'SMART connection expired. Reconnect to continue.', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
      throw error
    }

    await prisma.integrationAuditLog.create({
      data: {
        tenantId: practiceId,
        actorUserId: user.id,
        action: 'FHIR_READ',
        entity: 'Patient',
        entityId: parsed.data.patientId,
        metadata: {
          issuer: connection.issuer,
        },
      },
    })

    return NextResponse.json({ patient })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch patient'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
