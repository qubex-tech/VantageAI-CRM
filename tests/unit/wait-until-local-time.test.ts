import { describe, expect, it } from 'vitest'
import {
  isWithinSendWindow,
  msUntilLocalTime,
  msUntilSendWindow,
} from '@/lib/appointment-optimization/waitUntilLocalTime'

describe('msUntilLocalTime', () => {
  it('waits until later the same day when target is ahead', () => {
    // 2026-07-11 05:00 UTC = midnight CDT
    const now = new Date('2026-07-11T05:00:00.000Z')
    const ms = msUntilLocalTime({
      hour: 9,
      minute: 0,
      timeZone: 'America/Chicago',
      now,
      graceMs: 0,
    })
    // 9 hours
    expect(ms).toBe(9 * 60 * 60 * 1000)
  })

  it('rolls to next day when target already passed', () => {
    // 2026-07-11 16:00 UTC = 11:00 AM CDT
    const now = new Date('2026-07-11T16:00:00.000Z')
    const ms = msUntilLocalTime({
      hour: 9,
      minute: 0,
      timeZone: 'America/Chicago',
      now,
      graceMs: 0,
    })
    // ~22 hours until tomorrow 9am
    expect(ms).toBeGreaterThan(20 * 60 * 60 * 1000)
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })
})

describe('send window', () => {
  const tz = 'America/Chicago'

  it('is within window during business hours', () => {
    // 2026-07-11 15:00 UTC = 10:00 AM CDT
    const now = new Date('2026-07-11T15:00:00.000Z')
    expect(
      isWithinSendWindow({
        startHour: 9,
        endHour: 17,
        timeZone: tz,
        now,
      })
    ).toBe(true)
    expect(
      msUntilSendWindow({
        startHour: 9,
        endHour: 17,
        timeZone: tz,
        now,
        graceMs: 0,
      })
    ).toBe(0)
  })

  it('waits until window opens when before start', () => {
    // midnight CDT
    const now = new Date('2026-07-11T05:00:00.000Z')
    expect(
      isWithinSendWindow({
        startHour: 9,
        endHour: 17,
        timeZone: tz,
        now,
      })
    ).toBe(false)
    expect(
      msUntilSendWindow({
        startHour: 9,
        endHour: 17,
        timeZone: tz,
        now,
        graceMs: 0,
      })
    ).toBe(9 * 60 * 60 * 1000)
  })

  it('waits until next morning when after end', () => {
    // 6:00 PM CDT Saturday Jul 11 2026
    const now = new Date('2026-07-11T23:00:00.000Z')
    expect(
      isWithinSendWindow({
        startHour: 9,
        endHour: 17,
        timeZone: tz,
        now,
      })
    ).toBe(false)
    const ms = msUntilSendWindow({
      startHour: 9,
      endHour: 17,
      timeZone: tz,
      now,
      graceMs: 0,
    })
    expect(ms).toBeGreaterThan(14 * 60 * 60 * 1000)
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('skips weekends when only Mon–Fri allowed', () => {
    // Saturday Jul 11 2026 10:00 AM CDT — inside hours but weekend
    const saturday = new Date('2026-07-11T15:00:00.000Z')
    expect(
      isWithinSendWindow({
        startHour: 9,
        endHour: 17,
        daysOfWeek: [1, 2, 3, 4, 5],
        timeZone: tz,
        now: saturday,
      })
    ).toBe(false)

    const ms = msUntilSendWindow({
      startHour: 9,
      endHour: 17,
      daysOfWeek: [1, 2, 3, 4, 5],
      timeZone: tz,
      now: saturday,
      graceMs: 0,
    })
    // Next open: Monday Jul 13 9:00 AM CDT
    expect(ms).toBeGreaterThan(40 * 60 * 60 * 1000)
    expect(ms).toBeLessThan(50 * 60 * 60 * 1000)
  })

  it('allows Mon–Fri during business hours', () => {
    // Friday Jul 10 2026 10:00 AM CDT
    const friday = new Date('2026-07-10T15:00:00.000Z')
    expect(
      isWithinSendWindow({
        startHour: 9,
        endHour: 17,
        daysOfWeek: [1, 2, 3, 4, 5],
        timeZone: tz,
        now: friday,
      })
    ).toBe(true)
    expect(
      msUntilSendWindow({
        startHour: 9,
        endHour: 17,
        daysOfWeek: [1, 2, 3, 4, 5],
        timeZone: tz,
        now: friday,
        graceMs: 0,
      })
    ).toBe(0)
  })
})
