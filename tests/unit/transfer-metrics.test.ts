import { describe, it, expect } from 'vitest'
import {
  readTransferOutcomeFromCallRow,
  computeInboundTransferMetrics,
} from '@/lib/analytics/transferMetrics'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'

function row(metadata: Record<string, unknown> | null): AnalyticsCallRow {
  return {
    startedAt: '2026-01-15T12:00:00.000Z',
    endedAt: '2026-01-15T12:05:00.000Z',
    callerPhone: '5551234567',
    outcome: 'information_only',
    extractedIntent: null,
    metadata,
  }
}

describe('readTransferOutcomeFromCallRow', () => {
  it('reads transfer_outcome from retell_custom_data', () => {
    expect(
      readTransferOutcomeFromCallRow(
        row({ retell_custom_data: { transfer_outcome: 'successful' } })
      )
    ).toBe('successful')
  })

  it('reads human-readable Transfer Outcome key', () => {
    expect(
      readTransferOutcomeFromCallRow(
        row({ retell_custom_data: { 'Transfer Outcome': 'Successful' } })
      )
    ).toBe('Successful')
  })

  it('returns null when custom analysis is missing', () => {
    expect(readTransferOutcomeFromCallRow(row(null))).toBeNull()
    expect(readTransferOutcomeFromCallRow(row({}))).toBeNull()
  })
})

describe('computeInboundTransferMetrics', () => {
  it('counts successful transfer', () => {
    const metrics = computeInboundTransferMetrics([
      row({ retell_custom_data: { transfer_outcome: 'successful' } }),
    ])
    expect(metrics).toEqual({ transfersAttempted: 1, transfersSuccessful: 1 })
  })

  it('counts attempted but not successful for not successful', () => {
    const metrics = computeInboundTransferMetrics([
      row({ retell_custom_data: { transfer_outcome: 'not successful' } }),
    ])
    expect(metrics).toEqual({ transfersAttempted: 1, transfersSuccessful: 0 })
  })

  it('counts attempted but not successful for did-not-pick-up copy', () => {
    const metrics = computeInboundTransferMetrics([
      row({
        retell_custom_data: {
          transfer_outcome:
            'Transfer call cannot be completed, the other side did not pick up.',
        },
      }),
    ])
    expect(metrics).toEqual({ transfersAttempted: 1, transfersSuccessful: 0 })
  })

  it('returns zero when no transfer outcomes', () => {
    expect(computeInboundTransferMetrics([row({}), row(null)])).toEqual({
      transfersAttempted: 0,
      transfersSuccessful: 0,
    })
  })

  it('aggregates multiple rows', () => {
    const metrics = computeInboundTransferMetrics([
      row({ retell_custom_data: { 'Transfer Outcome': 'successful' } }),
      row({ retell_custom_data: { transfer_outcome: 'not successful' } }),
      row({}),
    ])
    expect(metrics).toEqual({ transfersAttempted: 2, transfersSuccessful: 1 })
  })
})
