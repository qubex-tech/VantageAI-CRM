import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { encryptString } from '@/lib/integrations/ehr/crypto'
import { getOrCreateStediIntegration, hasPlatformStediApiKey } from '@/lib/stedi/config'

const stediSettingsSchema = z.object({
  apiKey: z.string().optional().or(z.literal('')),
  environment: z.enum(['test', 'production']).optional(),
  apiBaseUrl: z.string().url().optional().or(z.literal('')),
  useMockResponses: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

function redact(integration: { apiKeyEnc?: string | null; [key: string]: unknown } | null) {
  if (!integration) return null
  return {
    ...integration,
    apiKeyEnc: undefined,
    hasApiKey: Boolean(integration.apiKeyEnc) || hasPlatformStediApiKey(),
  }
}

function resolvePracticeId(
  req: NextRequest,
  user: Awaited<ReturnType<typeof requireAuth>>,
  bodyPracticeId?: string
) {
  const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
  let practiceId: string | null = user.practiceId
  if ((bodyPracticeId || queryPracticeId) && isVantageAdmin({ ...user, name: user.name ?? null })) {
    practiceId = bodyPracticeId || queryPracticeId
  }
  return practiceId
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(req, user)
    if (!practiceId) return NextResponse.json({ integration: null })

    let integration = await prisma.stediIntegration.findUnique({ where: { practiceId } })
    if (!integration) {
      integration = await getOrCreateStediIntegration(practiceId)
    }
    return NextResponse.json({ integration: redact(integration) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Stedi settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const practiceId = resolvePracticeId(req, user, body.practiceId)
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const parsed = stediSettingsSchema.parse(body)
    await getOrCreateStediIntegration(practiceId)

    const data: Record<string, unknown> = {}
    if (parsed.apiKey && parsed.apiKey.trim()) {
      data.apiKeyEnc = encryptString(parsed.apiKey.trim())
    }
    if (parsed.environment !== undefined) data.environment = parsed.environment
    if (parsed.apiBaseUrl !== undefined) data.apiBaseUrl = parsed.apiBaseUrl || null
    if (parsed.useMockResponses !== undefined) data.useMockResponses = parsed.useMockResponses
    if (parsed.isActive !== undefined) data.isActive = parsed.isActive

    const integration = await prisma.stediIntegration.update({
      where: { practiceId },
      data,
    })

    return NextResponse.json({ integration: redact(integration) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Stedi settings' },
      { status: 500 }
    )
  }
}
