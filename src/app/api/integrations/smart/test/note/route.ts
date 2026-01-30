import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/smart/crypto'
import { FhirClient, WriteNotSupportedError } from '@/lib/integrations/fhir/fhirClient'
import { requireSmartUser, getSmartSettings, shouldEnableWrite } from '@/lib/integrations/smart/server'

const bodySchema = z.object({
  patientId: z.string().min(1),
  noteText: z.string().min(1),
  issuer: z.string().url().optional(),
  requireBinary: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { practiceId, user } = await requireSmartUser()
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const settings = await getSmartSettings(practiceId)
    if (!shouldEnableWrite(settings) || !settings?.enableNoteCreate) {
      return NextResponse.json(
        {
          error: 'Note creation is disabled. Enable write access for this tenant.',
          code: 'WRITE_DISABLED',
        },
        { status: 403 }
      )
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

    let capabilityStatement
    try {
      capabilityStatement = await client.getCapabilityStatement()
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

    const authorReference = (connection.userContext as any)?.fhirUser || undefined

    try {
      const created = await client.createDocumentReferenceNote({
        patientId: parsed.data.patientId,
        noteText: parsed.data.noteText,
        authorReference,
        preferPreliminary: false,
        requireBinary: parsed.data.requireBinary,
        capabilityStatement,
      })

      await prisma.integrationAuditLog.create({
        data: {
          tenantId: practiceId,
          actorUserId: user.id,
          action: 'FHIR_WRITE',
          entity: 'DocumentReference',
          entityId: created.id || '',
          metadata: {
            issuer: connection.issuer,
            patientId: parsed.data.patientId,
          },
        },
      })

      return NextResponse.json({
        id: created.id,
        reviewUrl: created.reviewUrl,
      })
    } catch (error) {
      if (error instanceof WriteNotSupportedError) {
        return NextResponse.json(
          {
            error:
              'Write is not supported by this EHR. Use read-only mode or request write access from your EHR administrator.',
            code: error.code,
            supportedInteractions: error.supportedInteractions,
          },
          { status: 409 }
        )
      }
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
