import { describe, expect, it } from 'vitest'
import {
  calBookingMatchesTimeWindow,
  isCalLinkedBooking,
} from '@/lib/integrations/cal/appointmentWriteback'

describe('cal appointment writeback', () => {
  it('detects Cal-linked bookings vs Open Dental links', () => {
    expect(isCalLinkedBooking('f88qSwaGht9yLUscvKErDF')).toBe(true)
    expect(isCalLinkedBooking('22134365')).toBe(true)
    expect(isCalLinkedBooking('opendental:apt:123')).toBe(false)
    expect(isCalLinkedBooking(null)).toBe(false)
  })

  it('matches Cal bookings to the original appointment start time', () => {
    const original = new Date('2026-07-14T14:30:00.000Z')
    expect(
      calBookingMatchesTimeWindow({ start: '2026-07-14T14:30:00.000Z' }, original)
    ).toBe(true)
    expect(
      calBookingMatchesTimeWindow({ start: '2026-07-14T15:30:00.000Z' }, original)
    ).toBe(false)
  })
})
