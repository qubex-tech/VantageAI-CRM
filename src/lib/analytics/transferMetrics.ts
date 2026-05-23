import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import {
  isUnsuccessfulTransferOutcomeText,
  readTransferOutcomeFromCustomAnalysisData,
} from '@/lib/outbound-customer-notifications'

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

/**
 * Reads Retell Transfer Outcome from a voice conversation row (metadata.retell_custom_data
 * or top-level transfer_outcome if present).
 */
export function readTransferOutcomeFromCallRow(row: AnalyticsCallRow): string | null {
  const meta = metadataRecord(row.metadata)
  const fromCustom = readTransferOutcomeFromCustomAnalysisData(
    meta.retell_custom_data as Record<string, unknown> | undefined
  )
  if (fromCustom) return fromCustom
  const topLevel = meta.transfer_outcome
  if (topLevel != null && String(topLevel).trim()) return String(topLevel).trim()
  return null
}

/**
 * Inbound transfer KPIs for analytics. Every call with a Transfer Outcome is
 * partitioned into successful or unsuccessful so attempted = successful + unsuccessful.
 *
 * - Unsuccessful: missed-transfer email rules (`isUnsuccessfulTransferOutcomeText`).
 * - Successful: any other non-empty outcome (includes known success phrases and other
 *   non-failure Retell wording not explicitly listed in `isSuccessfulTransferOutcomeText`).
 */
export function computeInboundTransferMetrics(rows: AnalyticsCallRow[]): {
  transfersAttempted: number
  transfersSuccessful: number
  transfersUnsuccessful: number
} {
  let transfersAttempted = 0
  let transfersSuccessful = 0
  let transfersUnsuccessful = 0
  for (const row of rows) {
    const outcome = readTransferOutcomeFromCallRow(row)
    if (!outcome) continue
    transfersAttempted += 1
    if (isUnsuccessfulTransferOutcomeText(outcome)) {
      transfersUnsuccessful += 1
    } else {
      transfersSuccessful += 1
    }
  }
  return { transfersAttempted, transfersSuccessful, transfersUnsuccessful }
}
