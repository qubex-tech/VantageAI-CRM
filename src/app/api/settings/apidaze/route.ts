import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { apidazeIntegrationSchema } from '@/lib/validations'
import {
  formatE164,
  getApidazeInboundWebhookUrl,
  getApidazePlatformClient,
  isApidazePlatformConfigured,
} from '@/lib/apidaze'
import { buildApidazeSenderNotOnAccountError } from '@/lib/sms-sender-validation'

export const dynamic = 'force-dynamic'

function resolvePracticeId(
  user: { practiceId: string | null; name?: string | null; id: string; email: string; role: string },
  queryPracticeId: string | null
): string | null {
  const normalizedUser = {
    ...user,
    name: user.name ?? null,
  }
  if (queryPracticeId && isVantageAdmin(normalizedUser)) {
    return queryPracticeId
  }
  return user.practiceId
}

function formatZodError(error: unknown) {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
    const zodError = error as unknown as { issues: Array<{ path: (string | number)[]; message: string }> }
    return zodError.issues
      .map((issue) => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      })
      .join(', ')
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(user, req.nextUrl.searchParams.get('practiceId'))
    const platformConfigured = isApidazePlatformConfigured()

    if (!practiceId) {
      return NextResponse.json({
        platformConfigured,
        webhookUrl: getApidazeInboundWebhookUrl(),
        integration: null,
      })
    }

    try {
      const integration = await prisma.apidazeIntegration.findUnique({
        where: { practiceId },
      })
      return NextResponse.json({
        platformConfigured,
        webhookUrl: getApidazeInboundWebhookUrl(),
        integration,
      })
    } catch (error) {
      console.error('Error fetching Apidaze integration (table may not exist):', error)
      return NextResponse.json({
        platformConfigured,
        webhookUrl: getApidazeInboundWebhookUrl(),
        integration: null,
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Apidaze settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(user, req.nextUrl.searchParams.get('practiceId'))

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    if (!isApidazePlatformConfigured()) {
      return NextResponse.json(
        { error: 'Apidaze is not configured. Set APIDAZE_API_KEY and APIDAZE_API_SECRET on the server.' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = apidazeIntegrationSchema.parse(body)
    const fromNumber = formatE164(validated.fromNumber)

    const client = getApidazePlatformClient(fromNumber)
    const numbers = await client.listPhoneNumbers()
    const selected = numbers.find((entry) =>
      entry.phoneNumber === fromNumber ||
      entry.phoneNumber.replace(/[^\d]/g, '') === fromNumber.replace(/[^\d]/g, '')
    )
    if (!selected) {
      return NextResponse.json(
        { error: buildApidazeSenderNotOnAccountError(fromNumber) },
        { status: 400 }
      )
    }

    const integration = await prisma.apidazeIntegration.upsert({
      where: { practiceId },
      create: {
        practiceId,
        fromNumber,
        isActive: validated.isActive ?? true,
      },
      update: {
        fromNumber,
        isActive: validated.isActive ?? true,
      },
    })

    return NextResponse.json({
      platformConfigured: true,
      webhookUrl: getApidazeInboundWebhookUrl(),
      integration,
    })
  } catch (error) {
    const zodMessage = formatZodError(error)
    if (zodMessage) {
      return NextResponse.json({ error: `Validation error: ${zodMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Apidaze settings' },
      { status: 500 }
    )
  }
}
