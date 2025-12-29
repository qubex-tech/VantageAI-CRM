import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'

const retellIntegrationSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  agentId: z.string().optional(),
})

/**
 * Get RetellAI integration settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const integration = await prisma.retellIntegration.findUnique({
      where: { practiceId: user.practiceId },
    })

    return NextResponse.json({ integration })
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

    const validated = retellIntegrationSchema.parse(body)

    // Test connection by attempting to list calls
    const { RetellApiClient } = await import('@/lib/retell-api')
    const testClient = new RetellApiClient(validated.apiKey)
    try {
      await testClient.listCalls({ limit: 1 })
    } catch (error) {
      console.error('RetellAI API test failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      // Return more detailed error message to help user debug
      return NextResponse.json(
        { error: `Invalid API key or connection failed: ${errorMessage}. Please check your RetellAI API key.` },
        { status: 400 }
      )
    }

    // Create or update integration
    const integration = await prisma.retellIntegration.upsert({
      where: { practiceId: user.practiceId },
      create: {
        practiceId: user.practiceId,
        apiKey: validated.apiKey,
        agentId: validated.agentId,
        isActive: true,
      },
      update: {
        apiKey: validated.apiKey,
        agentId: validated.agentId,
      },
    })

    return NextResponse.json({ integration })
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

