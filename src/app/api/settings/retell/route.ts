import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { z } from 'zod'

function isMissingCurogramColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('retell_integrations.curogramEscalationEnabled') ||
    message.includes('retell_integrations.curogramEscalationUrl')
  )
}

const retellIntegrationSchema = z.object({
  apiKey: z.string().optional().or(z.literal('')),
  agentId: z.string().optional(),
  portalChatAgentId: z.string().optional(),
  insuranceVerificationAgentId: z.string().optional(),
  curogramEscalationEnabled: z.boolean().optional(),
  curogramEscalationUrl: z.string().url().optional().or(z.literal('')),
  mcpBaseUrl: z.string().url().optional().or(z.literal('')),
  mcpApiKey: z.string().optional(),
  mcpActorId: z.string().optional(),
  mcpRequestIdPrefix: z.string().optional(),
  outboundToolName: z.string().optional(),
})

function redactIntegration(integration: any) {
  if (!integration) return null
  return {
    ...integration,
    apiKey: integration.apiKey ? '********' : null,
    hasApiKey: Boolean(integration.apiKey),
    mcpApiKey: integration.mcpApiKey ? '********' : null,
    hasMcpApiKey: Boolean(integration.mcpApiKey),
  }
}

/**
 * Get RetellAI integration settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    const queryPracticeId = searchParams.get('practiceId')

    // Normalize user object for type compatibility
    const normalizedUser = {
      ...user,
      name: user.name ?? null,
    }

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(normalizedUser)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json({ integration: null })
    }

    let integration: any
    try {
      integration = await prisma.retellIntegration.findUnique({
        where: { practiceId: practiceId },
      })
    } catch (error) {
      if (!isMissingCurogramColumnError(error)) throw error
      integration = await prisma.retellIntegration.findUnique({
        where: { practiceId: practiceId },
        select: {
          id: true,
          practiceId: true,
          apiKey: true,
          agentId: true,
          portalChatAgentId: true,
          insuranceVerificationAgentId: true,
          mcpBaseUrl: true,
          mcpApiKey: true,
          mcpActorId: true,
          mcpRequestIdPrefix: true,
          outboundToolName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      if (integration) {
        integration = {
          ...integration,
          curogramEscalationEnabled: false,
          curogramEscalationUrl: null,
        }
      }
    }

    return NextResponse.json({ integration: redactIntegration(integration) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch RetellAI settings' },
      { status: 500 }
    )
  }
}

/**
 * Create or update RetellAI integration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const searchParams = req.nextUrl.searchParams
    const queryPracticeId = searchParams.get('practiceId')

    // Normalize user object for type compatibility
    const normalizedUser = {
      ...user,
      name: user.name ?? null,
    }

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(normalizedUser)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const validated = retellIntegrationSchema.parse(body)
    const portalChatAgentId = validated.portalChatAgentId?.trim() || null
    const existingIntegration = await prisma.retellIntegration.findUnique({
      where: { practiceId: practiceId },
      select: { apiKey: true },
    })
    const resolvedApiKey = validated.apiKey?.trim() || existingIntegration?.apiKey
    const curogramEscalationEnabled = Boolean(validated.curogramEscalationEnabled)
    const curogramEscalationUrl = validated.curogramEscalationUrl?.trim() || null

    if (!resolvedApiKey) {
      return NextResponse.json(
        { error: 'Retell API key is required for initial setup.' },
        { status: 400 }
      )
    }

    if (curogramEscalationEnabled && !curogramEscalationUrl) {
      return NextResponse.json(
        { error: 'Curogram escalation URL is required when Curogram escalation is enabled.' },
        { status: 400 }
      )
    }

    // Only validate upstream Retell key when the key was changed/entered.
    if (validated.apiKey?.trim()) {
      const { RetellApiClient } = await import('@/lib/retell-api')
      const testClient = new RetellApiClient(resolvedApiKey)
      try {
        await testClient.listCalls({ limit: 1 })
      } catch (error) {
        console.error('RetellAI API test failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
          { error: `Invalid API key or connection failed: ${errorMessage}. Please check your RetellAI API key.` },
          { status: 400 }
        )
      }
    }

    // Create or update integration
    let integration: any
    try {
      integration = await prisma.retellIntegration.upsert({
        where: { practiceId: practiceId },
        create: {
          practiceId: practiceId,
          apiKey: resolvedApiKey,
          agentId: validated.agentId,
          portalChatAgentId,
          insuranceVerificationAgentId: validated.insuranceVerificationAgentId || null,
          curogramEscalationEnabled,
          curogramEscalationUrl,
          mcpBaseUrl: validated.mcpBaseUrl || null,
          mcpApiKey: validated.mcpApiKey || null,
          mcpActorId: validated.mcpActorId || null,
          mcpRequestIdPrefix: validated.mcpRequestIdPrefix || null,
          outboundToolName: validated.outboundToolName || null,
          isActive: true,
        },
        update: {
          apiKey: resolvedApiKey,
          agentId: validated.agentId,
          portalChatAgentId,
          insuranceVerificationAgentId: validated.insuranceVerificationAgentId || null,
          curogramEscalationEnabled,
          curogramEscalationUrl,
          mcpBaseUrl: validated.mcpBaseUrl || null,
          mcpApiKey: validated.mcpApiKey || null,
          mcpActorId: validated.mcpActorId || null,
          mcpRequestIdPrefix: validated.mcpRequestIdPrefix || null,
          outboundToolName: validated.outboundToolName || null,
        },
      })
    } catch (error) {
      if (!isMissingCurogramColumnError(error)) throw error
      integration = await prisma.retellIntegration.upsert({
        where: { practiceId: practiceId },
        create: {
          practiceId: practiceId,
          apiKey: resolvedApiKey,
          agentId: validated.agentId,
          portalChatAgentId,
          insuranceVerificationAgentId: validated.insuranceVerificationAgentId || null,
          mcpBaseUrl: validated.mcpBaseUrl || null,
          mcpApiKey: validated.mcpApiKey || null,
          mcpActorId: validated.mcpActorId || null,
          mcpRequestIdPrefix: validated.mcpRequestIdPrefix || null,
          outboundToolName: validated.outboundToolName || null,
          isActive: true,
        },
        update: {
          apiKey: resolvedApiKey,
          agentId: validated.agentId,
          portalChatAgentId,
          insuranceVerificationAgentId: validated.insuranceVerificationAgentId || null,
          mcpBaseUrl: validated.mcpBaseUrl || null,
          mcpApiKey: validated.mcpApiKey || null,
          mcpActorId: validated.mcpActorId || null,
          mcpRequestIdPrefix: validated.mcpRequestIdPrefix || null,
          outboundToolName: validated.outboundToolName || null,
        },
      })
      integration = {
        ...integration,
        curogramEscalationEnabled: false,
        curogramEscalationUrl: null,
      }
    }

    return NextResponse.json({ integration: redactIntegration(integration) })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zodError = error as unknown as { issues: Array<{ path: (string | number)[]; message: string }> }
      const errorMessage = zodError.issues.map(issue => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      }).join(', ')
      return NextResponse.json({ error: `Validation error: ${errorMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save RetellAI settings' },
      { status: 500 }
    )
  }
}

