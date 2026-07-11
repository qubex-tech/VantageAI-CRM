import { describe, expect, it } from 'vitest'
import { msUntilLocalTime } from '@/lib/appointment-optimization/waitUntilLocalTime'

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
