import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { emitEvent } from '@/lib/outbox'
import { z } from 'zod'

const testEventSchema = z.object({
  eventName: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  data: z.record(z.any()),
})

/**
 * Test endpoint: creates an outbox event and triggers publish
 * Useful for testing automation rules
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = testEventSchema.parse(body)

    // Create outbox event
    const outboxEvent = await emitEvent({
      practiceId: user.practiceId,
      eventName: validated.eventName,
      entityType: validated.entityType,
      entityId: validated.entityId || 'test-entity-id',
      data: {
        ...validated.data,
        userId: user.id,
        test: true,
      },
    })

    // Trigger publish immediately (for testing)
    try {
      const publishResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/internal/outbox/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const publishResult = await publishResponse.json()

      return NextResponse.json({
        success: true,
        outboxEvent: {
          id: outboxEvent.id,
          name: outboxEvent.name,
          status: outboxEvent.status,
        },
        publishResult,
      })
    } catch (publishError) {
      // Outbox event was created, but publish failed (that's okay for testing)
      return NextResponse.json({
        success: true,
        outboxEvent: {
          id: outboxEvent.id,
          name: outboxEvent.name,
          status: outboxEvent.status,
        },
        warning: 'Outbox event created but publish endpoint not accessible',
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test event' },
      { status: 500 }
    )
  }
}

