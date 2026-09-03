import { prisma } from '@/lib/db'
import { isInboundAgentCall } from '@/lib/analytics/voiceConversationInbound'
import {
  CALL_FEED_PAGE_SIZE,
  callFeedCursorWhere,
  decodeCallFeedCursor,
  encodeCallFeedCursor,
  mapVoiceConversationToFeedItem,
  type CallFeedCursor,
  type CallFeedPage,
} from '@/lib/dashboard/callFeed'

const FEED_SELECT = {
  id: true,
  retellCallId: true,
  startedAt: true,
  endedAt: true,
  callerPhone: true,
  outcome: true,
  metadata: true,
} as const

export async function loadCallFeedPage(options: {
  practiceId: string
  cursor?: string | null
  limit?: number
}): Promise<CallFeedPage> {
  const limit = Math.min(Math.max(options.limit ?? CALL_FEED_PAGE_SIZE, 1), 50)
  const decoded = options.cursor ? decodeCallFeedCursor(options.cursor) : null
  if (options.cursor && !decoded) {
    throw new Error('Invalid cursor')
  }

  const items: CallFeedPage['items'] = []
  let nextRawCursor: CallFeedCursor | null = decoded
  let exhausted = false
  const batchSize = Math.max(limit * 3, 20)

  while (items.length < limit + 1 && !exhausted) {
    const rows = await prisma.voiceConversation.findMany({
      where: {
        practiceId: options.practiceId,
        NOT: {
          outcome: 'outbound_insurance_verification_initiated',
        },
        ...(nextRawCursor ? callFeedCursorWhere(nextRawCursor) : {}),
      },
      select: FEED_SELECT,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: batchSize,
    })

    if (rows.length < batchSize) exhausted = true
    if (rows.length === 0) break

    const last = rows[rows.length - 1]
    nextRawCursor = { startedAt: last.startedAt.toISOString(), id: last.id }

    for (const row of rows) {
      if (!isInboundAgentCall(row)) continue
      items.push(mapVoiceConversationToFeedItem(row))
      if (items.length >= limit + 1) break
    }
  }

  const hasMore = items.length > limit
  const page = items.slice(0, limit)
  const lastItem = page[page.length - 1]

  return {
    items: page,
    nextCursor:
      hasMore && lastItem
        ? encodeCallFeedCursor({ startedAt: lastItem.startedAt, id: lastItem.id })
        : null,
  }
}
