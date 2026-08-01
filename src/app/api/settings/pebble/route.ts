import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { pebbleIntegrationSchema } from '@/lib/validations'
import { isVantageAdmin } from '@/lib/permissions'
import { generatePebbleWebhookSecret } from '@/lib/pebble-webhook'

function redactPebbleIntegration(
  integration: {
    id: string
    practiceId: string
    webhookSecret: string | null
    providerUserId: string | null
    activeSessionId: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    provider?: { id: string; name: string; email: string } | null
  } | null,
  opts?: { revealSecret?: string | null }
) {
  if (!integration) return null
  const { webhookSecret: _secret, ...rest } = integration
  return {
    ...rest,
    webhookSecret: opts?.revealSecret ?? '',
    hasWebhookSecret: Boolean(integration.webhookSecret),
  }
}

function resolvePracticeId(req: NextRequest, user: Awaited<ReturnType<typeof requireAuth>>) {
  const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
  const normalizedUser = {
    ...user,
    name: user.name ?? null,
  }
  if (queryPracticeId && isVantageAdmin(normalizedUser)) {
    return queryPracticeId
  }
  return user.practiceId
}

/**
 * GET Pebble Index → Aria integration settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = await resolvePracticeId(req, user)

    if (!practiceId) {
      return NextResponse.json({ integration: null, webhookUrl: null })
    }

    const integration = await prisma.pebbleIntegration.findUnique({
      where: { practiceId },
      include: {
        provider: { select: { id: true, name: true, email: true } },
      },
    })

    const origin = req.nextUrl.origin
    return NextResponse.json({
      integration: redactPebbleIntegration(integration),
      webhookUrl: `${origin}/api/pebble/webhook`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Pebble settings' },
      { status: 500 }
    )
  }
}

/**
 * Create or update Pebble Index → Aria integration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = await resolvePracticeId(req, user)

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = pebbleIntegrationSchema.parse(body)

    const existing = await prisma.pebbleIntegration.findUnique({
      where: { practiceId },
    })

    if (validated.providerUserId) {
      const provider = await prisma.user.findFirst({
        where: { id: validated.providerUserId, practiceId },
        select: { id: true },
      })
      if (!provider) {
        return NextResponse.json({ error: 'Provider not found in this practice' }, { status: 400 })
      }
    }

    let webhookSecret = existing?.webhookSecret ?? null
    let revealedSecret: string | null = null

    if (validated.rotateSecret) {
      webhookSecret = generatePebbleWebhookSecret()
      revealedSecret = webhookSecret
    } else if (validated.webhookSecret !== undefined) {
      webhookSecret = validated.webhookSecret
      revealedSecret = validated.webhookSecret
    }

    if (!webhookSecret && !existing) {
      webhookSecret = generatePebbleWebhookSecret()
      revealedSecret = webhookSecret
    }

    const integration = await prisma.pebbleIntegration.upsert({
      where: { practiceId },
      create: {
        practiceId,
        webhookSecret,
        providerUserId: validated.providerUserId ?? null,
        isActive: validated.isActive ?? true,
        activeSessionId: null,
      },
      update: {
        ...(validated.rotateSecret || validated.webhookSecret !== undefined
          ? { webhookSecret }
          : {}),
        ...(validated.providerUserId !== undefined ? { providerUserId: validated.providerUserId } : {}),
        ...(validated.isActive !== undefined ? { isActive: validated.isActive } : {}),
        ...(validated.clearActiveSession ? { activeSessionId: null } : {}),
      },
      include: {
        provider: { select: { id: true, name: true, email: true } },
      },
    })

    const origin = req.nextUrl.origin
    return NextResponse.json({
      integration: redactPebbleIntegration(integration, { revealSecret: revealedSecret }),
      webhookUrl: `${origin}/api/pebble/webhook`,
      /** Present only when a new secret was generated/set — copy into Pebble app now */
      revealedSecret,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zodError = error as unknown as {
        issues: Array<{ path: (string | number)[]; message: string }>
      }
      const errorMessage = zodError.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ')
      return NextResponse.json({ error: `Validation error: ${errorMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Pebble settings' },
      { status: 500 }
    )
  }
}
