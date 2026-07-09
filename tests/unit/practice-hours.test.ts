import { describe, expect, it } from 'vitest'
import { zonedLocalToUtc } from '@/lib/calendar/expandCalendarBlocks'
import { getSlotHoursViolation } from '@/lib/practice-hours/availability'
import { parseHoursOfOperationSettings } from '@/lib/practice-hours/settings'
import { DEFAULT_HOURS_OF_OPERATION } from '@/lib/practice-hours/types'

const TZ = 'America/Chicago'

describe('parseHoursOfOperationSettings', () => {
  it('returns weekday defaults when unset', () => {
    const settings = parseHoursOfOperationSettings(null)
    expect(settings.days.monday.enabled).toBe(true)
    expect(settings.days.saturday.enabled).toBe(false)
    expect(settings.lunch.enabled).toBe(true)
    expect(settings.lunch.start).toBe('12:00')
  })

  it('preserves explicit closed weekdays', () => {
    const settings = parseHoursOfOperationSettings({
      days: {
        ...DEFAULT_HOURS_OF_OPERATION.days,
        wednesday: { enabled: false, open: '08:00', close: '17:00' },
      },
      lunch: { enabled: false, start: '12:00', end: '13:00' },
    })
    expect(settings.days.wednesday.enabled).toBe(false)
    expect(settings.lunch.enabled).toBe(false)
  })
})

describe('getSlotHoursViolation', () => {
  const settings = parseHoursOfOperationSettings(DEFAULT_HOURS_OF_OPERATION)

  it('allows a mid-morning weekday slot', () => {
    // Friday Jul 10 2026 10:00–10:30 Chicago
    const start = zonedLocalToUtc(2026, 7, 10, 10, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 10, 30, 0, TZ)
    expect(getSlotHoursViolation(settings, start, end, TZ)).toBeNull()
  })

  it('rejects Saturday when closed', () => {
    const start = zonedLocalToUtc(2026, 7, 11, 10, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 11, 10, 30, 0, TZ)
    expect(getSlotHoursViolation(settings, start, end, TZ)).toBe(
      'outside_hours_of_operation'
    )
  })

  it('rejects slots before open', () => {
    const start = zonedLocalToUtc(2026, 7, 10, 7, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 7, 30, 0, TZ)
    expect(getSlotHoursViolation(settings, start, end, TZ)).toBe(
      'outside_hours_of_operation'
    )
  })

  it('rejects slots overlapping lunch', () => {
    const start = zonedLocalToUtc(2026, 7, 10, 12, 15, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 12, 45, 0, TZ)
    expect(getSlotHoursViolation(settings, start, end, TZ)).toBe('during_lunch')
  })

  it('allows slots after lunch when lunch enabled', () => {
    const start = zonedLocalToUtc(2026, 7, 10, 13, 0, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 13, 30, 0, TZ)
    expect(getSlotHoursViolation(settings, start, end, TZ)).toBeNull()
  })

  it('ignores lunch when lunch disabled', () => {
    const noLunch = parseHoursOfOperationSettings({
      ...DEFAULT_HOURS_OF_OPERATION,
      lunch: { enabled: false, start: '12:00', end: '13:00' },
    })
    const start = zonedLocalToUtc(2026, 7, 10, 12, 15, 0, TZ)
    const end = zonedLocalToUtc(2026, 7, 10, 12, 45, 0, TZ)
    expect(getSlotHoursViolation(noLunch, start, end, TZ)).toBeNull()
  })
})
