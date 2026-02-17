import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { FhirClient, WriteNotSupportedError } from '@/lib/integrations/fhir/fhirClient'
import { resolveEhrPractice, getEhrSettings, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { createDraftDocumentReference } from '@/lib/integrations/fhir/resources/documentReference'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'

const bodySchema = z.object({
  providerId: z.string(),
  patientId: z.string().min(1),
  noteText: z.string().min(1),
  issuer: z.string().url().optional(),
  requireBinary: z.boolean().optional(),
  practiceId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { practiceId, user } = await resolveEhrPractice(parsed.data.practiceId)

    const settings = await getEhrSettings(practiceId)
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }
    if (!settings?.enableWrite || !settings.enableNoteCreate) {
      return NextResponse.json(
        {
          error: 'Note creation is disabled. Enable write access for this tenant.',
          code: 'WRITE_DISABLED',
        },
        { status: 403 }
      )
    }

    const connection = await prisma.ehrConnection.findFirst({
      where: {
        tenantId: practiceId,
        providerId: parsed.data.providerId,
        issuer: parsed.data.issuer || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!connection?.accessTokenEnc) {
      return NextResponse.json({ error: 'No active EHR connection' }, { status: 404 })
    }

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

    let capabilityStatement
    try {
      capabilityStatement = await client.getCapabilityStatement()
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
        return NextResponse.json(
          { error: 'EHR connection expired. Reconnect to continue.', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
      throw error
    }

    const authorReference = (connection.idTokenClaimsSummary as any)?.fhirUser || undefined

    try {
      const created = await createDraftDocumentReference({
        client,
        patientId: parsed.data.patientId,
        noteText: parsed.data.noteText,
        authorReference,
        preferPreliminary: false,
        requireBinary: parsed.data.requireBinary,
        capabilityStatement,
      })

      await logEhrAudit({
        tenantId: practiceId,
        actorUserId: user.id,
        action: 'FHIR_WRITE',
        providerId: connection.providerId,
        entity: 'DocumentReference',
        entityId: created.id || undefined,
        metadata: {
          patientId: parsed.data.patientId,
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
