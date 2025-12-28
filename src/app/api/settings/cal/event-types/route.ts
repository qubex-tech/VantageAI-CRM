import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { calEventTypeMappingSchema } from '@/lib/validations'
import { getCalClient } from '@/lib/cal'

/**
 * Get event type mappings for the practice
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const mappings = await prisma.calEventTypeMapping.findMany({
      where: { practiceId: user.practiceId },
      include: {
        calIntegration: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json({ mappings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch event type mappings' },
      { status: 500 }
    )
  }
}

/**
 * Create event type mapping
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const validated = calEventTypeMappingSchema.parse(body)

    // Verify integration exists
    const integration = await prisma.calIntegration.findUnique({
      where: { practiceId: user.practiceId },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Cal.com integration not configured' }, { status: 400 })
    }

    const mapping = await prisma.calEventTypeMapping.create({
      data: {
        practiceId: user.practiceId,
        calIntegrationId: integration.id,
        visitTypeName: validated.visitTypeName,
        calEventTypeId: validated.calEventTypeId,
      },
    })

    return NextResponse.json({ mapping }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create event type mapping' },
      { status: 500 }
    )
  }
}

