import { prisma } from './db'
import { inngest } from '@/inngest/client'

/**
 * Outbox pattern for reliable event publishing
 * 
 * Events are written to the database transactionally,
 * then published asynchronously by the outbox publisher.
 */

export interface OutboxEventData {
  practiceId: string
  eventName: string
  entityType: string
  entityId: string
  data: Record<string, any>
}

/**
 * Create an outbox event (to be published later)
 */
export async function createOutboxEvent(eventData: OutboxEventData) {
  return prisma.outboxEvent.create({
    data: {
      practiceId: eventData.practiceId,
      name: eventData.eventName,
      payload: {
        clinicId: eventData.practiceId,
        eventName: eventData.eventName,
        entityType: eventData.entityType,
        entityId: eventData.entityId,
        data: eventData.data,
        occurredAt: new Date().toISOString(),
      },
      status: 'pending',
    },
  })
}

/**
 * Publish a single outbox event to Inngest
 */
export async function publishOutboxEvent(eventId: string) {
  const event = await prisma.outboxEvent.findUnique({
    where: { id: eventId },
  })

  if (!event || event.status !== 'pending') {
    return { success: false, error: 'Event not found or not pending' }
  }

  try {
    // Send to Inngest
    await inngest.send({
      name: 'crm/event.received',
      data: {
        ...(event.payload as any),
        sourceEventId: event.id,
      },
    })

    // Mark as published
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'published',
        attempts: event.attempts + 1,
      },
    })

    return { success: true }
  } catch (error) {
    const attempts = event.attempts + 1
    const MAX_ATTEMPTS = 5

    if (attempts >= MAX_ATTEMPTS) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'failed',
          attempts,
        },
      })
    } else {
      const backoffSeconds = Math.min(60 * Math.pow(2, attempts - 1), 3600)
      const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000)

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts,
          nextAttemptAt,
        },
      })
    }

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Emit an event (creates outbox event and optionally publishes immediately)
 * Use this in your code paths to emit events
 * 
 * @param eventData - Event data
 * @param publishImmediately - If true, immediately publish to Inngest (default: true in dev, false in prod)
 */
export async function emitEvent(
  eventData: OutboxEventData,
  publishImmediately: boolean = process.env.NODE_ENV === 'development'
) {
  const outboxEvent = await createOutboxEvent(eventData)

  // In development, automatically publish events for easier testing
  // In production, rely on the scheduled outbox publisher
  if (publishImmediately) {
    // Fire and forget - don't block on publishing
    publishOutboxEvent(outboxEvent.id).catch((error) => {
      console.error('Failed to publish event immediately:', error)
    })
  }

  return outboxEvent
}

