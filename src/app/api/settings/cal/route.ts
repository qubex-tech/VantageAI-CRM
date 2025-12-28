import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { calIntegrationSchema, calEventTypeMappingSchema } from '@/lib/validations'
import { getCalClient } from '@/lib/cal'

/**
 * Get Cal.com integration settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()

    const integration = await prisma.calIntegration.findUnique({
      where: { practiceId: user.practiceId },
      include: {
        eventTypeMappings: true,
      },
    })

    return NextResponse.json({ integration })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Cal.com settings' },
      { status: 500 }
    )
  }
}

/**
 * Create or update Cal.com integration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const validated = calIntegrationSchema.parse(body)

    // Test connection
    const { CalApiClient } = await import('@/lib/cal')
    const testClient = new CalApiClient(validated.apiKey)
    const isValid = await testClient.testConnection()

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid API key or connection failed' }, { status: 400 })
    }

    // Create or update integration
    const integration = await prisma.calIntegration.upsert({
      where: { practiceId: user.practiceId },
      create: {
        practiceId: user.practiceId,
        apiKey: validated.apiKey,
        calOrganizationId: validated.calOrganizationId,
        calTeamId: validated.calTeamId,
        isActive: true,
      },
      update: {
        apiKey: validated.apiKey,
        calOrganizationId: validated.calOrganizationId,
        calTeamId: validated.calTeamId,
      },
      include: {
        eventTypeMappings: true,
      },
    })

    return NextResponse.json({ integration })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Cal.com settings' },
      { status: 500 }
    )
  }
}

