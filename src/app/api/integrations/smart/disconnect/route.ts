import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptString } from '@/lib/integrations/smart/crypto'
import { revokeToken } from '@/lib/integrations/smart/smartClient'
import { requireSmartUser } from '@/lib/integrations/smart/server'

const bodySchema = z.object({
  issuer: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { practiceId, user } = await requireSmartUser()
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const connection = await prisma.smartFhirConnection.findFirst({
      where: {
        practiceId,
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
        })
      } catch (error) {
        revocationFailed = true
      }
    }

    await prisma.smartFhirConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: null,
        refreshTokenEnc: null,
        idTokenEnc: null,
        expiresAt: null,
        status: 'revoked',
      },
    })

    await prisma.integrationAuditLog.create({
      data: {
        tenantId: practiceId,
        actorUserId: user.id,
        action: 'SMART_DISCONNECT',
        entity: 'SmartFhirConnection',
        entityId: connection.id,
        metadata: {
          issuer: connection.issuer,
        },
      },
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
