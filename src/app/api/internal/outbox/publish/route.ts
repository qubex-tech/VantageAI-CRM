import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { inngest } from '@/inngest/client'

/**
 * Outbox publisher endpoint
 * 
 * Fetches pending outbox events and publishes them to Inngest.
 * Should be called periodically (cron job or scheduled task).
 * 
 * In production, this should be:
 * - Protected with an internal API key
 * - Called by a cron job or Vercel Cron
 * - Rate-limited to prevent abuse
 */

const BATCH_SIZE = 50
const MAX_ATTEMPTS = 5

export async function POST(req: NextRequest) {
  try {
    // Optional: Add authentication check here
    // const authHeader = req.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const now = new Date()

    // Fetch pending events that are ready to retry
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: {
        status: 'pending',
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: now } },
        ],
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    })

    const results = {
      processed: 0,
      published: 0,
      failed: 0,
      skipped: 0,
    }

    for (const event of pendingEvents) {
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

        results.published++
      } catch (error) {
        const attempts = event.attempts + 1

        if (attempts >= MAX_ATTEMPTS) {
          // Mark as failed after max attempts
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'failed',
              attempts,
            },
          })
          results.failed++
        } else {
          // Schedule retry with exponential backoff
          const backoffSeconds = Math.min(60 * Math.pow(2, attempts - 1), 3600) // Max 1 hour
          const nextAttemptAt = new Date(now.getTime() + backoffSeconds * 1000)

          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              attempts,
              nextAttemptAt,
            },
          })
          results.skipped++
        }

        console.error(`Failed to publish event ${event.id}:`, error)
      }

      results.processed++
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.processed} events: ${results.published} published, ${results.failed} failed, ${results.skipped} scheduled for retry`,
    })
  } catch (error) {
    console.error('Outbox publisher error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint for health check / manual trigger
export async function GET(req: NextRequest) {
  const pendingCount = await prisma.outboxEvent.count({
    where: { status: 'pending' },
  })

  const failedCount = await prisma.outboxEvent.count({
    where: { status: 'failed' },
  })

  return NextResponse.json({
    status: 'ok',
    pending: pendingCount,
    failed: failedCount,
    message: 'Use POST to publish pending events',
  })
}

