import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCHEDULED_APPOINTMENT_LOOKAHEAD_DAYS,
  FUTURE_SCHEDULED_APPOINTMENT_STATUS,
  appointmentWindowEnd,
  buildFutureScheduledAppointmentWhere,
  encounterCountsAsUpcomingScheduled,
  extractScheduledAppointmentLookahead,
  parseScheduledAppointmentLookaheadDays,
} from '@/automations/patient-future-appointment'

describe('patient future scheduled appointment condition helpers', () => {
  it('builds a where clause for future scheduled appointments only', () => {
    const now = new Date('2026-07-30T15:00:00.000Z')
    expect(
      buildFutureScheduledAppointmentWhere('practice-1', 'patient-1', now)
    ).toEqual({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      status: FUTURE_SCHEDULED_APPOINTMENT_STATUS,
      startTime: { gt: now },
    })
    expect(FUTURE_SCHEDULED_APPOINTMENT_STATUS).toBe('scheduled')
  })

  it('caps the CRM query to a look-ahead window', () => {
    const now = new Date('2026-08-24T13:00:00.000Z')
    const until = appointmentWindowEnd(now, 60)
    expect(until?.toISOString()).toBe('2026-10-23T13:00:00.000Z')
    expect(
      buildFutureScheduledAppointmentWhere('practice-1', 'patient-1', now, until)
    ).toEqual({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      status: 'scheduled',
      startTime: { gt: now, lte: until },
    })
  })

  it('parses look-ahead days and ignores invalid values', () => {
    expect(parseScheduledAppointmentLookaheadDays(60)).toBe(60)
    expect(parseScheduledAppointmentLookaheadDays('90')).toBe(90)
    expect(parseScheduledAppointmentLookaheadDays(0)).toBeUndefined()
    expect(parseScheduledAppointmentLookaheadDays(500)).toBe(365)
    expect(DEFAULT_SCHEDULED_APPOINTMENT_LOOKAHEAD_DAYS).toBe(60)
  })

  it('extracts withinDays from nested automation conditions', () => {
    expect(
      extractScheduledAppointmentLookahead({
        operator: 'and',
        conditions: [
          {
            field: 'patient.hasFutureScheduledAppointment',
            operator: 'equals',
            value: false,
            withinDays: 60,
          },
        ],
      })
    ).toEqual({ used: true, withinDays: 60 })

    expect(
      extractScheduledAppointmentLookahead({
        field: 'patient.hasFutureScheduledAppointment',
        operator: 'equals',
        value: true,
      })
    ).toEqual({ used: true, withinDays: undefined })

    expect(extractScheduledAppointmentLookahead({ field: 'patient.email', operator: 'exists' })).toEqual({
      used: false,
      withinDays: undefined,
    })
  })

  it('counts planned eCW encounters inside the window', () => {
    const now = new Date('2026-08-24T18:00:00.000Z')
    const until = appointmentWindowEnd(now, 60)
    expect(
      encounterCountsAsUpcomingScheduled({
        status: 'planned',
        start: '2026-09-10T08:30:00-05:00',
        now,
        until,
      })
    ).toBe(true)
    expect(
      encounterCountsAsUpcomingScheduled({
        status: 'planned',
        start: '2026-11-25T08:00:00-06:00',
        now,
        until,
      })
    ).toBe(false)
    expect(
      encounterCountsAsUpcomingScheduled({
        status: 'finished',
        start: '2026-09-10T08:30:00-05:00',
        now,
        until,
      })
    ).toBe(false)
  })
})
