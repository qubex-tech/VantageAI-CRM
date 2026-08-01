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
    providerUserId: string
    activeSessionId: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    provider?: { id: string; name: string; email: string } | null
  },
  opts?: { revealSecret?: string | null }
) {
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
 * GET all Pebble Index ring credentials for a practice
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(req, user)

    if (!practiceId) {
      return NextResponse.json({ integrations: [], webhookUrl: null })
    }

    const integrations = await prisma.pebbleIntegration.findMany({
      where: { practiceId },
      include: {
        provider: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    })

    const origin = req.nextUrl.origin
    return NextResponse.json({
      integrations: integrations.map((row) => redactPebbleIntegration(row)),
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
 * Manage per-provider Pebble Index ring credentials
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(req, user)

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const validated = pebbleIntegrationSchema.parse(await req.json())
    const origin = req.nextUrl.origin
    const webhookUrl = `${origin}/api/pebble/webhook`

    if (validated.action === 'create') {
      const provider = await prisma.user.findFirst({
        where: { id: validated.providerUserId, practiceId },
        select: { id: true },
      })
      if (!provider) {
        return NextResponse.json({ error: 'Provider not found in this practice' }, { status: 400 })
      }

      const existing = await prisma.pebbleIntegration.findUnique({
        where: {
          practiceId_providerUserId: {
            practiceId,
            providerUserId: validated.providerUserId,
          },
        },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'This clinician already has an Index ring credential. Rotate that secret instead.' },
          { status: 409 }
        )
      }

      const webhookSecret = generatePebbleWebhookSecret()
      const integration = await prisma.pebbleIntegration.create({
        data: {
          practiceId,
          providerUserId: validated.providerUserId,
          webhookSecret,
          isActive: validated.isActive ?? true,
          activeSessionId: null,
        },
        include: {
          provider: { select: { id: true, name: true, email: true } },
        },
      })

      return NextResponse.json({
        integration: redactPebbleIntegration(integration, { revealSecret: webhookSecret }),
        webhookUrl,
        revealedSecret: webhookSecret,
      })
    }

    const existing = await prisma.pebbleIntegration.findFirst({
      where: { id: validated.id, practiceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    if (validated.action === 'delete') {
      await prisma.pebbleIntegration.delete({ where: { id: existing.id } })
      return NextResponse.json({ ok: true, webhookUrl })
    }

    let revealedSecret: string | null = null
    const data: {
      webhookSecret?: string
      isActive?: boolean
      activeSessionId?: string | null
    } = {}

    if (validated.action === 'rotate') {
      revealedSecret = generatePebbleWebhookSecret()
      data.webhookSecret = revealedSecret
    } else if (validated.action === 'update') {
      if (validated.isActive !== undefined) data.isActive = validated.isActive
    } else if (validated.action === 'clearActiveSession') {
      data.activeSessionId = null
    }

    const integration = await prisma.pebbleIntegration.update({
      where: { id: existing.id },
      data,
      include: {
        provider: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      integration: redactPebbleIntegration(integration, { revealSecret: revealedSecret }),
      webhookUrl,
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
