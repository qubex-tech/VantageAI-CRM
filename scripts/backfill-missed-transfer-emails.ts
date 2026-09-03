/**
 * Backfill Missed Transfer Alert emails that were skipped after Retell
 * switched Transfer Outcome to short enums like "failed".
 *
 *   npx tsx --env-file=.env.vercel.runtime scripts/backfill-missed-transfer-emails.ts
 *   npx tsx --env-file=.env.vercel.runtime scripts/backfill-missed-transfer-emails.ts --send
 */

import { prisma } from '../src/lib/db'
import { getRetellClient, type RetellCall } from '../src/lib/retell-api'
import {
  isUnsuccessfulTransferOutcomeText,
  maybeNotifyUnsuccessfulTransfer,
  readTransferOutcomeFromCustomAnalysisData,
} from '../src/lib/outbound-customer-notifications'

const LONESTAR_PRACTICE_ID = '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
/** Exclusive lower bound: last successful missed-transfer send. */
const SINCE = new Date(process.argv.find((a) => a.startsWith('--since='))?.slice('--since='.length) || '2026-08-26T20:00:00.000Z')
const DELAY_MS = 350
const SHOULD_SEND = process.argv.includes('--send')

type Meta = Record<string, unknown>

function asObject(value: unknown): Meta {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Meta) : {}
}

function asString(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function readOutcome(meta: Meta): string | null {
  const fromCustom = readTransferOutcomeFromCustomAnalysisData(
    meta.retell_custom_data as Record<string, unknown> | undefined
  )
  if (fromCustom) return fromCustom
  return asString(meta.transfer_outcome)
}

function callFromConversation(row: {
  retellCallId: string | null
  callerPhone: string
  startedAt: Date
  endedAt: Date | null
  metadata: unknown
}): RetellCall {
  const meta = asObject(row.metadata)
  const custom =
    meta.retell_custom_data && typeof meta.retell_custom_data === 'object' && !Array.isArray(meta.retell_custom_data)
      ? (meta.retell_custom_data as Record<string, unknown>)
      : {}
  const outcome = readOutcome(meta)
  if (outcome && !('transfer_outcome' in custom) && !('Transfer Outcome' in custom)) {
    custom['Transfer Outcome'] = outcome
  }
  const direction = meta.retell_call_direction === 'outbound' ? 'outbound' : 'inbound'
  const fromNumber =
    asString(meta.user_phone_number) ||
    asString(meta.patient_phone_number) ||
    row.callerPhone ||
    undefined

  return {
    call_id: row.retellCallId || 'unknown',
    call_type: 'phone_call',
    agent_id: asString(meta.agent_id) || 'unknown',
    call_status: 'ended',
    direction,
    from_number: direction === 'inbound' ? fromNumber : undefined,
    to_number: direction === 'outbound' ? fromNumber : undefined,
    start_timestamp: row.startedAt.getTime(),
    end_timestamp: (row.endedAt ?? row.startedAt).getTime(),
    call_analysis: {
      custom_analysis_data: custom,
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const conversations = await prisma.voiceConversation.findMany({
    where: {
      practiceId: LONESTAR_PRACTICE_ID,
      startedAt: { gt: SINCE },
    },
    select: {
      id: true,
      practiceId: true,
      retellCallId: true,
      callerPhone: true,
      startedAt: true,
      endedAt: true,
      metadata: true,
    },
    orderBy: { startedAt: 'asc' },
  })

  const candidates = conversations.filter((row) => {
    const meta = asObject(row.metadata)
    if (asString(meta.unsuccessfulTransferEmailSentAt)) return false
    const outcome = readOutcome(meta)
    return Boolean(outcome && isUnsuccessfulTransferOutcomeText(outcome))
  })

  const byOutcome: Record<string, number> = {}
  for (const row of candidates) {
    const outcome = readOutcome(asObject(row.metadata)) || '(none)'
    byOutcome[outcome] = (byOutcome[outcome] || 0) + 1
  }

  console.log(
    JSON.stringify(
      {
        mode: SHOULD_SEND ? 'send' : 'dry-run',
        sinceExclusive: SINCE.toISOString(),
        candidateCount: candidates.length,
        byOutcome,
      },
      null,
      2
    )
  )

  if (!SHOULD_SEND) {
    console.log('Re-run with --send to deliver these emails.')
    return
  }

  if (candidates.length === 0) {
    console.log('Nothing to send.')
    return
  }

  const retell = await getRetellClient(LONESTAR_PRACTICE_ID)
  const results: Array<{
    conversationId: string
    retellCallId: string | null
    startedAt: string
    outcome: string | null
    status: 'sent' | 'failed' | 'skipped'
    messageId?: string | null
    error?: string | null
  }> = []

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i]
    const outcome = readOutcome(asObject(row.metadata))
    let call: RetellCall | null = null
    if (row.retellCallId) {
      try {
        call = await retell.getCall(row.retellCallId)
      } catch (error) {
        console.warn('Retell fetch failed, using stored metadata', {
          conversationId: row.id,
          retellCallId: row.retellCallId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    if (!call) call = callFromConversation(row)

    await maybeNotifyUnsuccessfulTransfer({
      practiceId: row.practiceId,
      call,
      conversationId: row.id,
    })

    const updated = await prisma.voiceConversation.findUnique({
      where: { id: row.id },
      select: { metadata: true },
    })
    const meta = asObject(updated?.metadata)
    const sentAt = asString(meta.unsuccessfulTransferEmailSentAt)
    const error = asString(meta.unsuccessfulTransferEmailError)
    const skip = asString(meta.unsuccessfulTransferEmailSkipReason)
    const status: 'sent' | 'failed' | 'skipped' = sentAt ? 'sent' : error ? 'failed' : 'skipped'

    results.push({
      conversationId: row.id,
      retellCallId: row.retellCallId,
      startedAt: row.startedAt.toISOString(),
      outcome,
      status,
      messageId: asString(meta.unsuccessfulTransferEmailMessageId),
      error: error || (status === 'skipped' ? skip : null),
    })

    console.log(
      `[${i + 1}/${candidates.length}] ${status} ${row.retellCallId ?? row.id} ${outcome ?? ''}`
    )

    if (i < candidates.length - 1) await sleep(DELAY_MS)
  }

  const sent = results.filter((r) => r.status === 'sent').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  console.log(JSON.stringify({ sent, failed, skipped, results }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
