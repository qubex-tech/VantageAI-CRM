import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

const DEFAULT_INTERVAL_MS = 60000
const KEEP_ALIVE_MS = 25000

function parseInterval(value: string | undefined) {
  if (!value) return DEFAULT_INTERVAL_MS
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MS
  return Math.min(Math.max(parsed, 10000), 5 * 60 * 1000)
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req)

  if (!user.practiceId) {
    return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
  }

  const practiceId = user.practiceId
  const encoder = new TextEncoder()
  const intervalMs = parseInterval(process.env.INBOX_POLL_INTERVAL_MS)

  let lastUnread = -1

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      const tick = async () => {
        const conversations = await prisma.communicationConversation.findMany({
          where: { practiceId },
          select: {
            id: true,
            lastMessagePreview: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                direction: true,
                readAt: true,
              },
            },
            patient: {
              select: {
                name: true,
                preferredName: true,
              },
            },
          },
          orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        })

        const unreadCount = conversations.reduce((count, conversation) => {
          const latest = conversation.messages[0]
          if (latest?.direction === 'inbound' && !latest.readAt) {
            return count + 1
          }
          return count
        }, 0)

        if (unreadCount === lastUnread) return
        lastUnread = unreadCount

        const latestUnread = conversations.find((conversation) => {
          const latest = conversation.messages[0]
          return latest?.direction === 'inbound' && !latest.readAt
        })

        send('unread', {
          unreadCount,
          latest: latestUnread
            ? {
                patientName:
                  latestUnread.patient.preferredName || latestUnread.patient.name || 'Patient',
                lastMessageSnippet: latestUnread.lastMessagePreview || '',
              }
            : null,
        })
      }

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`))
      }, KEEP_ALIVE_MS)

      const interval = setInterval(() => {
        tick().catch(() => null)
      }, intervalMs)

      tick().catch(() => null)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        clearInterval(keepAlive)
        controller.close()
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
