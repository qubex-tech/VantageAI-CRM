import { describe, expect, it } from 'vitest'
import {
  FUTURE_SCHEDULED_APPOINTMENT_STATUS,
  buildFutureScheduledAppointmentWhere,
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
})
