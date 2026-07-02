import { describe, it, expect } from 'vitest'
import { parseOpenDentalAptNumFromBookingId } from '@/lib/integrations/opendental/appointmentSync'

describe('parseOpenDentalAptNumFromBookingId', () => {
  it('parses opendental appointment external ids', () => {
    expect(parseOpenDentalAptNumFromBookingId('opendental:apt:72291')).toBe(72291)
  })

  it('returns null for non-OD booking ids', () => {
    expect(parseOpenDentalAptNumFromBookingId('cal-booking-123')).toBeNull()
    expect(parseOpenDentalAptNumFromBookingId(null)).toBeNull()
  })
})
