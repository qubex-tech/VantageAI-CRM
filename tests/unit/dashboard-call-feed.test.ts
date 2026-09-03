import { describe, expect, it } from 'vitest'
import {
  callFeedCursorWhere,
  decodeCallFeedCursor,
  encodeCallFeedCursor,
  formatCallFeedDayLabel,
  mapVoiceConversationToFeedItem,
  readCallFeedSummary,
  resolveCallFeedTransferStatus,
  type VoiceConversationFeedRow,
} from '@/lib/dashboard/callFeed'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'

function analyticsRow(metadata: Record<string, unknown> | null): AnalyticsCallRow {
  return {
    startedAt: '2026-09-02T17:00:00.000Z',
    endedAt: '2026-09-02T17:04:00.000Z',
    callerPhone: '5551234567',
    outcome: 'information_only',
    extractedIntent: null,
    metadata,
  }
}

function feedRow(
  overrides: Partial<VoiceConversationFeedRow> & { metadata?: unknown } = {}
): VoiceConversationFeedRow {
  return {
    id: 'conv-1',
    retellCallId: 'call_abc',
    startedAt: '2026-09-02T17:00:00.000Z',
    endedAt: '2026-09-02T17:04:20.000Z',
    callerPhone: '5551234567',
    outcome: 'information_only',
    metadata: null,
    ...overrides,
  }
}

describe('resolveCallFeedTransferStatus', () => {
  it('returns none when transfer outcome is missing', () => {
    expect(resolveCallFeedTransferStatus(analyticsRow(null))).toEqual({
      transferStatus: 'none',
      transferOutcomeRaw: null,
    })
    expect(resolveCallFeedTransferStatus(analyticsRow({}))).toEqual({
      transferStatus: 'none',
      transferOutcomeRaw: null,
    })
  })

  it('returns successful for non-failure transfer outcomes', () => {
    expect(
      resolveCallFeedTransferStatus(
        analyticsRow({ retell_custom_data: { transfer_outcome: 'successful' } })
      )
    ).toEqual({
      transferStatus: 'successful',
      transferOutcomeRaw: 'successful',
    })
    expect(
      resolveCallFeedTransferStatus(
        analyticsRow({
          retell_custom_data: {
            'Transfer Outcome': 'transferred to staff for appointment scheduling',
          },
        })
      ).transferStatus
    ).toBe('successful')
  })

  it('returns unsuccessful for failed transfer phrases', () => {
    expect(
      resolveCallFeedTransferStatus(
        analyticsRow({ retell_custom_data: { transfer_outcome: 'not successful' } })
      )
    ).toEqual({
      transferStatus: 'unsuccessful',
      transferOutcomeRaw: 'not successful',
    })
    expect(
      resolveCallFeedTransferStatus(
        analyticsRow({
          retell_custom_data: {
            transfer_outcome:
              'Transfer call cannot be completed, the other side did not pick up.',
          },
        })
      ).transferStatus
    ).toBe('unsuccessful')
  })
})

describe('readCallFeedSummary', () => {
  it('prefers call_summary over detailed_call_summary', () => {
    expect(
      readCallFeedSummary({
        call_summary: '  Booked a cleaning  ',
        detailed_call_summary: 'Longer version',
      })
    ).toBe('Booked a cleaning')
  })

  it('falls back to detailed_call_summary', () => {
    expect(readCallFeedSummary({ detailed_call_summary: 'Full notes' })).toBe('Full notes')
  })

  it('returns null when both summaries are missing', () => {
    expect(readCallFeedSummary(null)).toBeNull()
    expect(readCallFeedSummary({})).toBeNull()
    expect(readCallFeedSummary({ call_summary: '   ' })).toBeNull()
  })
})

describe('mapVoiceConversationToFeedItem', () => {
  it('maps name, phone, duration, summary, and successful transfer', () => {
    const item = mapVoiceConversationToFeedItem(
      feedRow({
        metadata: {
          patient_name: 'Jane Doe',
          call_summary: 'Asked about hours',
          retell_custom_data: { transfer_outcome: 'transferred successfully' },
        },
      })
    )

    expect(item).toMatchObject({
      id: 'conv-1',
      retellCallId: 'call_abc',
      callerDisplayName: 'Jane Doe',
      callerPhone: '(555) 123-4567',
      summary: 'Asked about hours',
      transferStatus: 'successful',
      durationSeconds: 260,
    })
  })

  it('falls back to caller phone when no display name is present', () => {
    const item = mapVoiceConversationToFeedItem(feedRow({ metadata: {} }))
    expect(item.callerDisplayName).toBe('5551234567')
    expect(item.summary).toBeNull()
    expect(item.transferStatus).toBe('none')
  })
})

describe('call feed cursor', () => {
  it('round-trips startedAt and id', () => {
    const cursor = { startedAt: '2026-09-02T17:00:00.000Z', id: 'conv-9' }
    expect(decodeCallFeedCursor(encodeCallFeedCursor(cursor))).toEqual(cursor)
  })

  it('returns null for invalid cursor strings', () => {
    expect(decodeCallFeedCursor('not-valid')).toBeNull()
    expect(decodeCallFeedCursor(encodeCallFeedCursor({ startedAt: 'nope', id: 'x' }))).toBeNull()
  })

  it('builds a composite Prisma where clause', () => {
    const startedAt = new Date('2026-09-02T17:00:00.000Z')
    expect(
      callFeedCursorWhere({ startedAt: startedAt.toISOString(), id: 'conv-9' })
    ).toEqual({
      OR: [{ startedAt: { lt: startedAt } }, { startedAt, id: { lt: 'conv-9' } }],
    })
  })
})

describe('formatCallFeedDayLabel', () => {
  const timeZone = 'America/Chicago'
  const now = new Date('2026-09-03T02:00:00.000Z')

  it('labels today and yesterday in the practice timezone', () => {
    expect(formatCallFeedDayLabel('2026-09-02T20:00:00.000Z', timeZone, now)).toBe('Today')
    expect(formatCallFeedDayLabel('2026-09-01T20:00:00.000Z', timeZone, now)).toBe('Yesterday')
  })

  it('uses a weekday label for older days', () => {
    expect(formatCallFeedDayLabel('2026-08-30T20:00:00.000Z', timeZone, now)).toBe(
      'Sunday, Aug 30'
    )
  })
})
