import { prisma } from '@/lib/db'
import { getRetellClient } from '@/lib/retell-api'

const LIST_PAGE_LIMIT = 1000
const MAX_LIST_PAGES = 50

async function listInboundCallsForRange(params: {
  practiceId: string
  agentId: string | null
  startMs: number
  endMs: number
}) {
  const retellClient = await getRetellClient(params.practiceId)
  const allCalls: Awaited<ReturnType<typeof retellClient.listCalls>>['calls'] = []
  let paginationKey: string | undefined

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const result = await retellClient.listCalls({
      agentId: params.agentId ?? undefined,
      limit: LIST_PAGE_LIMIT,
      startTimestamp: params.startMs,
      endTimestamp: params.endMs,
      paginationKey,
      directionInboundOnly: true,
    })

    const batch = result.calls || []
    allCalls.push(...batch)

    if (batch.length < LIST_PAGE_LIMIT) break
    const last = batch[batch.length - 1]
    if (!last?.call_id) break
    paginationKey = last.call_id
  }

  return allCalls
}

/** Count inbound Retell calls in range (matches Retell dashboard list-calls filter). */
export async function countRetellInboundCallsForRange(params: {
  practiceId: string
  agentId: string | null
  startMs: number
  endMs: number
}): Promise<number> {
  const calls = await listInboundCallsForRange(params)
  return calls.length
}

/**
 * Import only Retell calls missing from voice_conversations so transfer metadata stays current
 * without reprocessing the full history on every dashboard load.
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
  const calls = await listInboundCallsForRange(params)

  let imported = 0
  let failed = 0

  const ended = calls.filter(
    (c) => c.call_status === 'ended' || c.call_status === 'completed'
  )

  for (const call of ended) {
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

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
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

    const ended = batch.filter(
      (c) => c.call_status === 'ended' || c.call_status === 'completed'
    )

    for (const c of ended) {
      try {
        const full = await retellClient.getCall(c.call_id)
        await processRetellCallData(params.practiceId, full, params.userId)
        processed += 1
      } catch {
        failed += 1
      }
    }

    if (batch.length < LIST_PAGE_LIMIT) break
    const last = batch[batch.length - 1]
    if (!last?.call_id) break
    paginationKey = last.call_id
  }

  return { pages, fetched, processed, failed }
}
