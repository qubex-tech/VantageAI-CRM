import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import { revokeToken } from '@/lib/integrations/ehr/smartEngine'
import { resolveEhrPractice, getEhrSettings } from '@/lib/integrations/ehr/server'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

const bodySchema = z.object({
  providerId: z.string(),
  issuer: z.string().url().optional(),
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

    const connection = await prisma.ehrConnection.findFirst({
      where: {
        tenantId: practiceId,
        providerId: parsed.data.providerId,
        issuer: parsed.data.issuer || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    let revocationFailed = false
    if (connection.revocationEndpoint && connection.refreshTokenEnc) {
      try {
        await revokeToken({
          revocationEndpoint: connection.revocationEndpoint,
          token: decryptString(connection.refreshTokenEnc),
          clientId: connection.clientId,
          clientSecret: connection.clientSecretEnc
            ? decryptString(connection.clientSecretEnc)
            : undefined,
        })
      } catch (error) {
        revocationFailed = true
      }
    }

    await prisma.ehrConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: null,
        refreshTokenEnc: null,
        expiresAt: null,
        status: 'disconnected',
      },
    })

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: user.id,
      action: 'EHR_DISCONNECT',
      providerId: connection.providerId,
      entity: 'EhrConnection',
      entityId: connection.id,
    })

    return NextResponse.json({
      success: true,
      revocationFailed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Disconnect failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
