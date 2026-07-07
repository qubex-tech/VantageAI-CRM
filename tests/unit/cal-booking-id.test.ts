import { describe, expect, it } from 'vitest'
import {
  calBookingAlreadyInLocalAppointments,
  calBookingIdAliases,
  calBookingIdsMatch,
  canonicalCalBookingId,
  localAppointmentMatchesCalBooking,
} from '@/lib/cal-booking-id'

describe('cal-booking-id', () => {
  it('prefers UID as canonical id', () => {
    expect(canonicalCalBookingId('f88qSwaGht9yLUscvKErDF', 22134365)).toBe(
      'f88qSwaGht9yLUscvKErDF'
    )
    expect(canonicalCalBookingId(null, 22134365)).toBe('22134365')
  })

  it('returns both uid and numeric aliases', () => {
    expect(calBookingIdAliases('abcUID', 12345)).toEqual(['abcUID', '12345'])
    expect(calBookingIdAliases('abcUID', 'abcUID')).toEqual(['abcUID'])
  })

  it('matches stored id against either alias form', () => {
    expect(calBookingIdsMatch('22134365', 'f88qSwaGht9yLUscvKErDF', 22134365)).toBe(true)
    expect(calBookingIdsMatch('f88qSwaGht9yLUscvKErDF', 'f88qSwaGht9yLUscvKErDF', 22134365)).toBe(
      true
    )
    expect(calBookingIdsMatch('other', 'f88qSwaGht9yLUscvKErDF', 22134365)).toBe(false)
  })

  it('detects local appointments that already represent a Cal booking', () => {
    const locals = [{ calBookingId: '22134365' }, { calBookingId: 'opendental:apt:99' }]
    const booking = { uid: 'f88qSwaGht9yLUscvKErDF', id: 22134365 }
    expect(localAppointmentMatchesCalBooking('22134365', booking)).toBe(true)
    expect(calBookingAlreadyInLocalAppointments(locals, booking)).toBe(true)
    expect(calBookingAlreadyInLocalAppointments([], booking)).toBe(false)
  })
})
