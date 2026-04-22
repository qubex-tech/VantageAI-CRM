import { getRetellClient } from '@/lib/retell-api'

const LIST_PAGE_LIMIT = 1000
const MAX_LIST_PAGES = 50

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
