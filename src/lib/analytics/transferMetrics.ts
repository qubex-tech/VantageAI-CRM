import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import {
  isSuccessfulTransferOutcomeText,
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

export function computeInboundTransferMetrics(rows: AnalyticsCallRow[]): {
  transfersAttempted: number
  transfersSuccessful: number
} {
  let transfersAttempted = 0
  let transfersSuccessful = 0
  for (const row of rows) {
    const outcome = readTransferOutcomeFromCallRow(row)
    if (!outcome) continue
    transfersAttempted += 1
    if (isSuccessfulTransferOutcomeText(outcome)) {
      transfersSuccessful += 1
    }
  }
  return { transfersAttempted, transfersSuccessful }
}
