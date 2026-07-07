import { describe, expect, it } from 'vitest'
import { isCalLinkedBooking } from '@/lib/integrations/cal/appointmentWriteback'

describe('cal appointment writeback', () => {
  it('detects Cal-linked bookings vs Open Dental links', () => {
    expect(isCalLinkedBooking('f88qSwaGht9yLUscvKErDF')).toBe(true)
    expect(isCalLinkedBooking('22134365')).toBe(true)
    expect(isCalLinkedBooking('opendental:apt:123')).toBe(false)
    expect(isCalLinkedBooking(null)).toBe(false)
  })
})
