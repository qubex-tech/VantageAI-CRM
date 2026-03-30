import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(), // conversationId for pagination
  unreadOnly: z.enum(['true', 'false']).optional(),
})

/**
 * GET /api/mobile/notifications
 *
 * Returns a unified notification feed for the mobile app, derived from:
 * 1. Unread inbound messages assigned to the user or their team
 * 2. Conversations recently assigned to the user
 *
 * Shape is kept flat so the mobile app can render a simple notification list
 * without needing to know about the full conversation model.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:mobile-notifications:list`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const params = req.nextUrl.searchParams
    const parsed = querySchema.safeParse({
      limit: params.get('limit') || 50,
      cursor: params.get('cursor') || undefined,
      unreadOnly: params.get('unreadOnly') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const { limit, cursor, unreadOnly } = parsed.data
    const practiceId = user.practiceId

    // Fetch conversations that have unread inbound messages and are
    // either assigned to this user, their team, or unassigned (open).
    const teamIds = await prisma.teamMember
      .findMany({ where: { userId: user.id }, select: { teamId: true } })
      .then((rows) => rows.map((r) => r.teamId))

    const conversations = await prisma.communicationConversation.findMany({
      where: {
        practiceId,
        ...(cursor ? { id: { lt: cursor } } : {}),
        messages: {
          some: {
            direction: 'inbound',
            ...(unreadOnly === 'true' ? { readAt: null } : {}),
          },
        },
        OR: [
          // assigned to me
          { assignments: { some: { assignedUserId: user.id, status: 'active' } } },
          // assigned to one of my teams
          ...(teamIds.length > 0
            ? [{ assignments: { some: { assignedTeamId: { in: teamIds }, status: 'active' } } }]
            : []),
          // unassigned open conversations
          { assignments: { none: {} }, status: 'open' },
        ],
      },
      select: {
        id: true,
        channel: true,
        status: true,
        lastMessageAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            primaryPhone: true,
            email: true,
          },
        },
        messages: {
          where: { direction: 'inbound', readAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            readAt: true,
            channel: true,
          },
        },
        _count: {
          select: {
            messages: {
              where: { direction: 'inbound', readAt: null },
            },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
    })

    const notifications = conversations
      .filter((c) => c.messages.length > 0 || unreadOnly !== 'true')
      .map((c) => {
        const latestMessage = c.messages[0]
        const patient = c.patient
        const patientName = patient
          ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.name || 'Unknown'
          : 'Unknown'

        return {
          id: c.id,
          type: 'message' as const,
          conversationId: c.id,
          channel: c.channel,
          conversationStatus: c.status,
          patientId: patient?.id ?? null,
          patientName,
          patientPhone: patient?.primaryPhone ?? null,
          patientEmail: patient?.email ?? null,
          unreadCount: c._count.messages,
          preview: latestMessage?.body
            ? latestMessage.body.length > 120
              ? latestMessage.body.slice(0, 117) + '…'
              : latestMessage.body
            : null,
          latestMessageAt: latestMessage?.createdAt ?? c.lastMessageAt,
          lastMessageAt: c.lastMessageAt,
        }
      })

    const nextCursor =
      conversations.length === limit ? conversations[conversations.length - 1].id : null

    return NextResponse.json({ notifications, nextCursor, count: notifications.length })
  } catch (err) {
    console.error('[mobile/notifications GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
