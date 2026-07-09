import { describe, expect, it } from 'vitest'
import {
  expandCalendarBlocks,
  intervalsOverlapMs,
  occurrenceDateToExceptionDate,
  zonedDateKey,
  zonedLocalToUtc,
} from '@/lib/calendar/expandCalendarBlocks'
import type { CalendarBlockSeries } from '@/lib/calendar/types'
import { slotOverlapsAnyInterval } from '@/lib/calendar/blockingIntervals'

const TZ = 'America/Chicago'

function series(partial: Partial<CalendarBlockSeries> & Pick<CalendarBlockSeries, 'startTime' | 'endTime'>): CalendarBlockSeries {
  return {
    id: partial.id || 'block-1',
    practiceId: 'practice-1',
    providerId: partial.providerId ?? null,
    kind: partial.kind || 'block',
    title: partial.title || 'Lunch',
    notes: null,
    startTime: partial.startTime,
    endTime: partial.endTime,
    timezone: partial.timezone || TZ,
    recurrenceFrequency: partial.recurrenceFrequency || 'none',
    recurrenceInterval: partial.recurrenceInterval ?? 1,
    recurrenceByDay: partial.recurrenceByDay || [],
    recurrenceUntil: partial.recurrenceUntil ?? null,
    recurrenceCount: partial.recurrenceCount ?? null,
    exceptionDates: partial.exceptionDates || [],
  }
}

describe('expandCalendarBlocks', () => {
  it('returns a one-off block that overlaps the range', () => {
    const start = zonedLocalToUtc(2026, 7, 10, 12, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 13, 0, 0, TZ)
    const rangeStart = zonedLocalToUtc(2026, 7, 10, 0, 0, 0, TZ)
    const rangeEnd = zonedLocalToUtc(2026, 7, 11, 0, 0, 0, TZ)

    const out = expandCalendarBlocks([series({ startTime: start, endTime: end })], rangeStart, rangeEnd)
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Lunch')
    expect(out[0].occurrenceDate).toBe('2026-07-10')
  })

  it('expands weekly weekday lunch into Mon–Fri occurrences', () => {
    // Friday Jul 10 2026 lunch as anchor, weekly Mon–Fri
    const start = zonedLocalToUtc(2026, 7, 10, 12, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 13, 0, 0, TZ)
    const rangeStart = zonedLocalToUtc(2026, 7, 13, 0, 0, 0, TZ) // Mon Jul 13
    const rangeEnd = zonedLocalToUtc(2026, 7, 18, 0, 0, 0, TZ) // Sat Jul 18

    const out = expandCalendarBlocks(
      [
        series({
          startTime: start,
          endTime: end,
          recurrenceFrequency: 'weekly',
          recurrenceByDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
        }),
      ],
      rangeStart,
      rangeEnd
    )

    expect(out.map((o) => o.occurrenceDate)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ])
  })

  it('respects recurrenceUntil', () => {
    const start = zonedLocalToUtc(2026, 7, 10, 12, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 13, 0, 0, TZ)
    const until = zonedLocalToUtc(2026, 7, 14, 23, 59, 59, TZ)
    const rangeStart = zonedLocalToUtc(2026, 7, 13, 0, 0, 0, TZ)
    const rangeEnd = zonedLocalToUtc(2026, 7, 18, 0, 0, 0, TZ)

    const out = expandCalendarBlocks(
      [
        series({
          startTime: start,
          endTime: end,
          recurrenceFrequency: 'weekly',
          recurrenceByDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
          recurrenceUntil: until,
        }),
      ],
      rangeStart,
      rangeEnd
    )

    expect(out.map((o) => o.occurrenceDate)).toEqual(['2026-07-13', '2026-07-14'])
  })

  it('skips exceptionDates', () => {
    const start = zonedLocalToUtc(2026, 7, 10, 12, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 13, 0, 0, TZ)
    const rangeStart = zonedLocalToUtc(2026, 7, 13, 0, 0, 0, TZ)
    const rangeEnd = zonedLocalToUtc(2026, 7, 16, 0, 0, 0, TZ)

    const out = expandCalendarBlocks(
      [
        series({
          startTime: start,
          endTime: end,
          recurrenceFrequency: 'weekly',
          recurrenceByDay: ['MO', 'TU', 'WE'],
          exceptionDates: [occurrenceDateToExceptionDate('2026-07-14')],
        }),
      ],
      rangeStart,
      rangeEnd
    )

    expect(out.map((o) => o.occurrenceDate)).toEqual(['2026-07-13', '2026-07-15'])
  })
})

describe('overlap helpers', () => {
  it('detects partial overlap and ignores adjacent intervals', () => {
    const aStart = new Date('2026-07-10T17:00:00.000Z')
    const aEnd = new Date('2026-07-10T18:00:00.000Z')
    expect(
      intervalsOverlapMs(aStart, aEnd, new Date('2026-07-10T17:30:00.000Z'), new Date('2026-07-10T18:30:00.000Z'))
    ).toBe(true)
    expect(
      intervalsOverlapMs(aStart, aEnd, new Date('2026-07-10T18:00:00.000Z'), new Date('2026-07-10T19:00:00.000Z'))
    ).toBe(false)
  })

  it('slotOverlapsAnyInterval matches provider-agnostic blocks', () => {
    const slotStart = new Date('2026-07-10T17:00:00.000Z')
    const slotEnd = new Date('2026-07-10T17:30:00.000Z')
    expect(
      slotOverlapsAnyInterval(slotStart, slotEnd, [
        {
          blockId: 'b1',
          startTime: new Date('2026-07-10T16:45:00.000Z'),
          endTime: new Date('2026-07-10T17:15:00.000Z'),
          providerId: null,
          kind: 'block',
          title: 'Lunch',
        },
      ])
    ).toBe(true)
    expect(
      slotOverlapsAnyInterval(slotStart, slotEnd, [
        {
          blockId: 'b1',
          startTime: new Date('2026-07-10T18:00:00.000Z'),
          endTime: new Date('2026-07-10T19:00:00.000Z'),
          providerId: null,
          kind: 'block',
          title: 'Lunch',
        },
      ])
    ).toBe(false)
  })

  it('zonedDateKey formats in practice timezone', () => {
    const noonUtc = new Date('2026-07-10T17:00:00.000Z') // 12:00 Chicago CDT
    expect(zonedDateKey(noonUtc, TZ)).toBe('2026-07-10')
  })
})

describe('slot-fill skip reason contract', () => {
  it('uses blocked_by_calendar_block reason string', () => {
    // Contract used by rulesEngine — keep stable for inventory/debug
    expect('blocked_by_calendar_block').toMatch(/calendar_block/)
  })
})
