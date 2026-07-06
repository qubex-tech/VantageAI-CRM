import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  getBufferWindowEnd,
  getLookAheadEnd,
  isWithinBufferWindow,
} from '@/lib/business-days'

const TZ = 'America/Chicago'

describe('business-days', () => {
  it('addBusinessDays skips weekends', () => {
    const friday = new Date('2026-07-10T15:00:00.000Z')
    const end = addBusinessDays(friday, 1, TZ)
    expect(end.getDay()).not.toBe(0)
    expect(end.getDay()).not.toBe(6)
  })

  it('isWithinBufferWindow includes slot within N business days', () => {
    const now = new Date('2026-07-06T15:00:00.000Z')
    const slot = new Date('2026-07-08T15:00:00.000Z')
    expect(isWithinBufferWindow(slot, 3, TZ, now)).toBe(true)
  })

  it('isWithinBufferWindow rejects slot in the past', () => {
    const now = new Date('2026-07-10T15:00:00.000Z')
    const slot = new Date('2026-07-06T15:00:00.000Z')
    expect(isWithinBufferWindow(slot, 5, TZ, now)).toBe(false)
  })

  it('getLookAheadEnd is after slot start', () => {
    const slotStart = new Date('2026-07-07T15:00:00.000Z')
    const end = getLookAheadEnd(slotStart, 5, TZ)
    expect(end.getTime()).toBeGreaterThan(slotStart.getTime())
  })

  it('getBufferWindowEnd covers buffer business days from anchor', () => {
    const now = new Date('2026-07-06T15:00:00.000Z')
    const end = getBufferWindowEnd(now, 2, TZ)
    expect(end.getTime()).toBeGreaterThan(now.getTime())
  })
})
