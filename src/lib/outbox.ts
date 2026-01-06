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
  console.log(`[OUTBOX] Attempting to publish event ${eventId}`)
  
  const event = await prisma.outboxEvent.findUnique({
    where: { id: eventId },
  })

  if (!event || event.status !== 'pending') {
    console.warn(`[OUTBOX] Event ${eventId} not found or not pending (status: ${event?.status})`)
    return { success: false, error: 'Event not found or not pending' }
  }

  // Check if Inngest is configured
  if (!process.env.INNGEST_EVENT_KEY) {
    console.error('[OUTBOX] INNGEST_EVENT_KEY is not set! Cannot publish events to Inngest.')
    return { success: false, error: 'INNGEST_EVENT_KEY not configured' }
  }

  try {
    console.log(`[OUTBOX] Sending event to Inngest:`, {
      eventId: event.id,
      eventName: event.name,
      payload: event.payload,
      hasEventKey: !!process.env.INNGEST_EVENT_KEY,
      hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
    })

    // Send to Inngest
    const result = await inngest.send({
      name: 'crm/event.received',
      data: {
        ...(event.payload as any),
        sourceEventId: event.id,
      },
    })

    console.log(`[OUTBOX] Event sent successfully:`, result)

    // Mark as published
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'published',
        attempts: event.attempts + 1,
      },
    })

    console.log(`[OUTBOX] Event ${eventId} marked as published`)
    return { success: true }
  } catch (error) {
    console.error(`[OUTBOX] Failed to publish event ${eventId}:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      eventId: event.id,
      eventName: event.name,
    })

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
      console.error(`[OUTBOX] Event ${eventId} marked as failed after ${attempts} attempts`)
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
      console.log(`[OUTBOX] Event ${eventId} scheduled for retry at ${nextAttemptAt.toISOString()}`)
    }

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Emit an event (creates outbox event and optionally publishes immediately)
 * Use this in your code paths to emit events
 * 
 * @param eventData - Event data
 * @param publishImmediately - If true, immediately publish to Inngest (default: true in dev and prod)
 */
export async function emitEvent(
  eventData: OutboxEventData,
  publishImmediately: boolean = true // Always publish immediately for reliability
) {
  console.log(`[OUTBOX] Creating outbox event:`, {
    eventName: eventData.eventName,
    entityType: eventData.entityType,
    entityId: eventData.entityId,
    practiceId: eventData.practiceId,
  })

  const outboxEvent = await createOutboxEvent(eventData)

  console.log(`[OUTBOX] Outbox event created: ${outboxEvent.id}`)

  // Always try to publish immediately (fire and forget)
  // The cron job will catch any that fail to publish
  if (publishImmediately) {
    publishOutboxEvent(outboxEvent.id)
      .then((result) => {
        if (result.success) {
          console.log(`[OUTBOX] Event ${outboxEvent.id} published immediately`)
        } else {
          console.error(`[OUTBOX] Failed to publish event ${outboxEvent.id} immediately:`, result.error)
        }
      })
      .catch((error) => {
        console.error(`[OUTBOX] Error publishing event ${outboxEvent.id} immediately:`, error)
        // Event remains in 'pending' status and will be retried by cron
      })
  }

  return outboxEvent
}

