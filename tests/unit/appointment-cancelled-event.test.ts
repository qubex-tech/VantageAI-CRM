import { describe, expect, it } from 'vitest'
import { shouldEmitAppointmentCancelledEvent } from '@/lib/appointment-optimization/appointmentChangeHandler'

describe('shouldEmitAppointmentCancelledEvent', () => {
  const now = new Date('2026-08-26T18:00:00.000Z')
  const future = new Date('2026-09-10T13:30:00.000Z')
  const past = new Date('2026-07-01T13:30:00.000Z')

  it('emits when a CRM or eCW visit changes from scheduled to cancelled', () => {
    expect(
      shouldEmitAppointmentCancelledEvent(
        { status: 'scheduled' },
        { status: 'cancelled', startTime: future },
        now
      )
    ).toBe(true)
  })

  it('does not re-emit when the visit is already cancelled', () => {
    expect(
      shouldEmitAppointmentCancelledEvent(
        { status: 'cancelled' },
        { status: 'cancelled', startTime: future },
        now
      )
    ).toBe(false)
  })

  it('emits a newly synced eCW cancelled encounter only if it is still upcoming', () => {
    expect(
      shouldEmitAppointmentCancelledEvent(null, { status: 'cancelled', startTime: future }, now)
    ).toBe(true)
    expect(
      shouldEmitAppointmentCancelledEvent(null, { status: 'cancelled', startTime: past }, now)
    ).toBe(false)
  })

  it('does not emit for non-cancelled statuses', () => {
    expect(
      shouldEmitAppointmentCancelledEvent(
        { status: 'scheduled' },
        { status: 'completed', startTime: future },
        now
      )
    ).toBe(false)
  })
})
