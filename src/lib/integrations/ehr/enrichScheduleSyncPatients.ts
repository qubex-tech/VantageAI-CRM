import { prisma } from '@/lib/db'
import { enrichPatientFromEhr } from '@/lib/integrations/ehr/enrichPatientFromEhr'

const ENRICH_CONCURRENCY = 3
/** Manual sync runs inline up to this many linked patients; remainder are queued. */
const INLINE_ENRICH_LIMIT = 30

export type ScheduleSyncEnrichResult = {
  eligiblePatientCount: number
  enriched: number
  partial: number
  skipped: number
  failed: number
  queued: number
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  async function worker() {
    while (index < items.length) {
      const current = index++
      results[current] = await fn(items[current])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function tallyEnrichResults(
  results: Awaited<ReturnType<typeof enrichPatientFromEhr>>[]
): Pick<ScheduleSyncEnrichResult, 'enriched' | 'partial' | 'skipped' | 'failed'> {
  let enriched = 0
  let partial = 0
  let skipped = 0
  let failed = 0

  for (const result of results) {
    if (result.status === 'success') enriched++
    else if (result.status === 'partial') partial++
    else if (result.status === 'skipped') skipped++
    else failed++
  }

  return { enriched, partial, skipped, failed }
}

async function queueEnrichViaInngest(practiceId: string, patientIds: string[]): Promise<number> {
  if (patientIds.length === 0) return 0
  const { inngest } = await import('@/inngest/client')
  const events = patientIds.map((patientId) => ({
    name: 'ehr/patient.enrich' as const,
    data: {
      practiceId,
      patientId,
      source: 'schedule_sync' as const,
      force: true,
    },
  }))
  await inngest.send(events)
  return events.length
}

/**
 * After schedule sync, pull demographics + insurance from eCW for touched patients.
 * Manual sync (preferInline) enriches immediately for up to INLINE_ENRICH_LIMIT patients.
 */
export async function enrichPatientsAfterScheduleSync(params: {
  practiceId: string
  patientIds: Iterable<string>
  preferInline?: boolean
}): Promise<ScheduleSyncEnrichResult> {
  const uniqueIds = Array.from(new Set(params.patientIds))
  if (uniqueIds.length === 0) {
    return {
      eligiblePatientCount: 0,
      enriched: 0,
      partial: 0,
      skipped: 0,
      failed: 0,
      queued: 0,
    }
  }

  const linkedPatients = await prisma.patient.findMany({
    where: {
      practiceId: params.practiceId,
      id: { in: uniqueIds },
      deletedAt: null,
      externalEhrId: { not: null },
    },
    select: { id: true },
  })
  const eligibleIds = linkedPatients.map((p) => p.id)

  if (eligibleIds.length === 0) {
    return {
      eligiblePatientCount: 0,
      enriched: 0,
      partial: 0,
      skipped: uniqueIds.length,
      failed: 0,
      queued: 0,
    }
  }

  const preferInline = params.preferInline === true
  const inlineIds = preferInline ? eligibleIds.slice(0, INLINE_ENRICH_LIMIT) : []
  const queueIds = preferInline ? eligibleIds.slice(INLINE_ENRICH_LIMIT) : eligibleIds

  let inlineTally = { enriched: 0, partial: 0, skipped: 0, failed: 0 }
  if (inlineIds.length > 0) {
    const results = await runWithConcurrency(inlineIds, ENRICH_CONCURRENCY, (patientId) =>
      enrichPatientFromEhr({
        practiceId: params.practiceId,
        patientId,
        actorUserId: 'system',
        source: 'schedule_sync',
        force: true,
        skipIfFreshWithinHours: null,
      })
    )
    inlineTally = tallyEnrichResults(results)
  }

  let queued = 0
  if (queueIds.length > 0) {
    try {
      queued = await queueEnrichViaInngest(params.practiceId, queueIds)
    } catch (error) {
      console.error('[enrichPatientsAfterScheduleSync] Failed to queue Inngest enrich events', {
        practiceId: params.practiceId,
        queueCount: queueIds.length,
        error: error instanceof Error ? error.message : String(error),
      })
      inlineTally.failed += queueIds.length
    }
  }

  return {
    eligiblePatientCount: eligibleIds.length,
    enriched: inlineTally.enriched,
    partial: inlineTally.partial,
    skipped: inlineTally.skipped,
    failed: inlineTally.failed,
    queued,
  }
}
