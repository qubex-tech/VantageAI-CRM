import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { encryptString } from '@/lib/integrations/ehr/crypto'
import { getOrCreateAvailityIntegration } from '@/lib/availity/config'

const availitySettingsSchema = z.object({
  clientId: z.string().optional().or(z.literal('')),
  clientSecret: z.string().optional().or(z.literal('')),
  environment: z.enum(['demo', 'production']).optional(),
  apiBaseUrl: z.string().url().optional().or(z.literal('')),
  defaultProviderNpi: z.string().optional().or(z.literal('')),
  defaultProviderTaxId: z.string().optional().or(z.literal('')),
  defaultServiceType: z.string().optional(),
  submitterId: z.string().optional().or(z.literal('')),
  submitterStateCode: z.string().optional().or(z.literal('')),
  useMockResponses: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

function redactIntegration(integration: {
  clientSecretEnc?: string | null
  [key: string]: unknown
} | null) {
  if (!integration) return null
  return {
    ...integration,
    clientSecretEnc: undefined,
    hasClientSecret: Boolean(integration.clientSecretEnc),
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const queryPracticeId = req.nextUrl.searchParams.get('practiceId')

    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin({ ...user, name: user.name ?? null })) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json({ integration: null })
    }

    let integration = await prisma.availityIntegration.findUnique({
      where: { practiceId },
    })
    if (!integration) {
      integration = await getOrCreateAvailityIntegration(practiceId)
    }

    return NextResponse.json({ integration: redactIntegration(integration) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Availity settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const queryPracticeId = req.nextUrl.searchParams.get('practiceId')

    let practiceId: string | null = user.practiceId
    if (body.practiceId && isVantageAdmin({ ...user, name: user.name ?? null })) {
      practiceId = body.practiceId
    } else if (queryPracticeId && isVantageAdmin({ ...user, name: user.name ?? null })) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const parsed = availitySettingsSchema.parse(body)
    await getOrCreateAvailityIntegration(practiceId)

    const data: Record<string, unknown> = {}
    if (parsed.clientId !== undefined) data.clientId = parsed.clientId || null
    if (parsed.clientSecret && parsed.clientSecret.trim()) {
      data.clientSecretEnc = encryptString(parsed.clientSecret.trim())
    }
    if (parsed.environment !== undefined) data.environment = parsed.environment
    if (parsed.apiBaseUrl !== undefined) data.apiBaseUrl = parsed.apiBaseUrl || null
    if (parsed.defaultProviderNpi !== undefined) data.defaultProviderNpi = parsed.defaultProviderNpi || null
    if (parsed.defaultProviderTaxId !== undefined) {
      data.defaultProviderTaxId = parsed.defaultProviderTaxId || null
    }
    if (parsed.defaultServiceType !== undefined) data.defaultServiceType = parsed.defaultServiceType || '30'
    if (parsed.submitterId !== undefined) data.submitterId = parsed.submitterId || null
    if (parsed.submitterStateCode !== undefined) data.submitterStateCode = parsed.submitterStateCode || null
    if (parsed.useMockResponses !== undefined) data.useMockResponses = parsed.useMockResponses
    if (parsed.isActive !== undefined) data.isActive = parsed.isActive

    const integration = await prisma.availityIntegration.update({
      where: { practiceId },
      data,
    })

    return NextResponse.json({ integration: redactIntegration(integration) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Availity settings' },
      { status: 500 }
    )
  }
}
