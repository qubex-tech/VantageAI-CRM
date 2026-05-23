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
    expect(metrics).toEqual({
      transfersAttempted: 1,
      transfersSuccessful: 1,
      transfersUnsuccessful: 0,
    })
  })

  it('counts Retell production outcome phrases as successful', () => {
    const metrics = computeInboundTransferMetrics([
      row({
        retell_custom_data: {
          'Transfer Outcome': 'transferred to staff for appointment scheduling',
        },
      }),
      row({ retell_custom_data: { transfer_outcome: 'transferred successfully' } }),
      row({ retell_custom_data: { transfer_outcome: 'transfer initiated' } }),
    ])
    expect(metrics).toEqual({
      transfersAttempted: 3,
      transfersSuccessful: 3,
      transfersUnsuccessful: 0,
    })
  })

  it('counts unsuccessful transfer for not successful', () => {
    const metrics = computeInboundTransferMetrics([
      row({ retell_custom_data: { transfer_outcome: 'not successful' } }),
    ])
    expect(metrics).toEqual({
      transfersAttempted: 1,
      transfersSuccessful: 0,
      transfersUnsuccessful: 1,
    })
  })

  it('counts unsuccessful for did-not-pick-up copy', () => {
    const metrics = computeInboundTransferMetrics([
      row({
        retell_custom_data: {
          transfer_outcome:
            'Transfer call cannot be completed, the other side did not pick up.',
        },
      }),
    ])
    expect(metrics).toEqual({
      transfersAttempted: 1,
      transfersSuccessful: 0,
      transfersUnsuccessful: 1,
    })
  })

  it('returns zero when no transfer outcomes', () => {
    expect(computeInboundTransferMetrics([row({}), row(null)])).toEqual({
      transfersAttempted: 0,
      transfersSuccessful: 0,
      transfersUnsuccessful: 0,
    })
  })

  it('aggregates multiple rows', () => {
    const metrics = computeInboundTransferMetrics([
      row({ retell_custom_data: { 'Transfer Outcome': 'successful' } }),
      row({ retell_custom_data: { transfer_outcome: 'not successful' } }),
      row({}),
    ])
    expect(metrics).toEqual({
      transfersAttempted: 2,
      transfersSuccessful: 1,
      transfersUnsuccessful: 1,
    })
  })

  it('counts non-failure outcomes as successful so attempted equals successful + unsuccessful', () => {
    const metrics = computeInboundTransferMetrics([
      row({ retell_custom_data: { transfer_outcome: 'transferred successfully' } }),
      row({ retell_custom_data: { transfer_outcome: 'not successful' } }),
      row({ retell_custom_data: { transfer_outcome: 'warm transfer to billing' } }),
    ])
    expect(metrics.transfersAttempted).toBe(3)
    expect(metrics.transfersSuccessful + metrics.transfersUnsuccessful).toBe(
      metrics.transfersAttempted
    )
    expect(metrics).toEqual({
      transfersAttempted: 3,
      transfersSuccessful: 2,
      transfersUnsuccessful: 1,
    })
  })
})
