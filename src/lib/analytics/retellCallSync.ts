import { prisma } from '@/lib/db'
import { getRetellClient } from '@/lib/retell-api'

const LIST_PAGE_LIMIT = 1000
const MAX_LIST_PAGES = 50

async function listCallsForRange(params: {
  practiceId: string
  agentId?: string | null
  startMs: number
  endMs: number
  directionInboundOnly?: boolean
}) {
  const retellClient = await getRetellClient(params.practiceId)
  const allCalls: Awaited<ReturnType<typeof retellClient.listCalls>>['calls'] = []
  let paginationKey: string | undefined
  let hasMore = true

  for (let page = 0; page < MAX_LIST_PAGES && hasMore; page++) {
    const result = await retellClient.listCalls({
      agentId: params.agentId ?? undefined,
      limit: LIST_PAGE_LIMIT,
      startTimestamp: params.startMs,
      endTimestamp: params.endMs,
      paginationKey,
      directionInboundOnly: params.directionInboundOnly,
    })

    const batch = result.calls || []
    allCalls.push(...batch)

    if (typeof result.hasMore === 'boolean') {
      hasMore = result.hasMore
      paginationKey = result.paginationKey
    } else {
      hasMore = batch.length >= LIST_PAGE_LIMIT
      const last = batch[batch.length - 1]
      paginationKey = last?.call_id
      if (batch.length < LIST_PAGE_LIMIT) hasMore = false
      if (!paginationKey) hasMore = false
    }
  }

  return allCalls
}

/** Count inbound calls for a specific agent (transfer sync, agent-scoped views). */
export async function countRetellInboundCallsForRange(params: {
  practiceId: string
  agentId: string | null
  startMs: number
  endMs: number
}): Promise<number> {
  const calls = await listCallsForRange({
    ...params,
    directionInboundOnly: true,
  })
  return calls.length
}

/**
 * Count all Retell calls in range for the practice API key (all agents, all directions).
 * Matches the Retell dashboard "past N days" total.
 */
export async function countRetellCallsForDashboardRange(params: {
  practiceId: string
  startMs: number
  endMs: number
}): Promise<number> {
  const calls = await listCallsForRange({
    practiceId: params.practiceId,
    agentId: null,
    startMs: params.startMs,
    endMs: params.endMs,
  })
  return calls.length
}

/**
 * Import only Retell calls missing from voice_conversations.
 */
export async function syncMissingRetellInboundCallsForRange(params: {
  practiceId: string
  userId: string
  agentId: string | null
  startMs: number
  endMs: number
}): Promise<{ fetched: number; imported: number; failed: number }> {
  const retellClient = await getRetellClient(params.practiceId)
  const { processRetellCallData } = await import('@/lib/process-call-data')
  const calls = await listCallsForRange({
    ...params,
    directionInboundOnly: true,
  })

  let imported = 0
  let failed = 0

  for (const call of calls) {
    const existing = await prisma.voiceConversation.findFirst({
      where: {
        practiceId: params.practiceId,
        retellCallId: call.call_id,
      },
      select: { id: true },
    })
    if (existing) continue

    try {
      const full = await retellClient.getCall(call.call_id)
      await processRetellCallData(params.practiceId, full, params.userId)
      imported += 1
    } catch {
      failed += 1
    }
  }

  return { fetched: calls.length, imported, failed }
}

/**
 * Pull inbound calls from Retell for the given UTC ms window and upsert CRM rows
 * via processRetellCallData (same path as /api/calls?process=true).
 */
export async function syncRetellInboundCallsForRange(params: {
  practiceId: string
  userId: string
  agentId: string | null
  startMs: number
  endMs: number
}): Promise<{ pages: number; fetched: number; processed: number; failed: number }> {
  const retellClient = await getRetellClient(params.practiceId)
  const { processRetellCallData } = await import('@/lib/process-call-data')

  let pages = 0
  let fetched = 0
  let processed = 0
  let failed = 0
  let paginationKey: string | undefined
  let hasMore = true

  for (let page = 0; page < MAX_LIST_PAGES && hasMore; page++) {
    const result = await retellClient.listCalls({
      agentId: params.agentId ?? undefined,
      limit: LIST_PAGE_LIMIT,
      startTimestamp: params.startMs,
      endTimestamp: params.endMs,
      paginationKey,
      directionInboundOnly: true,
    })

    const batch = result.calls || []
    pages += 1
    fetched += batch.length

    for (const c of batch) {
      try {
        const full = await retellClient.getCall(c.call_id)
        await processRetellCallData(params.practiceId, full, params.userId)
        processed += 1
      } catch {
        failed += 1
      }
    }

    if (typeof result.hasMore === 'boolean') {
      hasMore = result.hasMore
      paginationKey = result.paginationKey
    } else {
      hasMore = batch.length >= LIST_PAGE_LIMIT
      const last = batch[batch.length - 1]
      paginationKey = last?.call_id
      if (batch.length < LIST_PAGE_LIMIT) hasMore = false
      if (!paginationKey) hasMore = false
    }
  }

  return { pages, fetched, processed, failed }
}
