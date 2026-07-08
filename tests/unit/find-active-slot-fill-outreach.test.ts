import { describe, expect, it } from 'vitest'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

type Slot = {
  status: string
  slotStart: Date
}

type Appointment = {
  id: string
  status: string
  startTime: Date
}

type Attempt = {
  id: string
  patientId: string
  appointmentId: string | null
  openSlotEvent: Slot | null
  appointment: Appointment | null
}

function pickActiveSlotFillAttemptForTest(attempts: Attempt[]): Attempt | null {
  for (const attempt of attempts) {
    const slot = attempt.openSlotEvent
    if (!slot || slot.status !== OPEN_SLOT_STATUS.OPEN) continue
    if (slot.slotStart <= new Date()) continue
    if (!attempt.appointmentId || !attempt.appointment) continue
    if (!['scheduled', 'confirmed'].includes(attempt.appointment.status)) continue
    return attempt
  }
  return null
}

describe('active slot-fill outreach selection', () => {
  const futureSlot = new Date(Date.now() + 60 * 60 * 1000)

  it('prefers the first still-open offer in outreach order', () => {
    const attempts: Attempt[] = [
      {
        id: 'newer',
        patientId: 'patient-b',
        appointmentId: 'appt-b',
        openSlotEvent: { status: OPEN_SLOT_STATUS.OPEN, slotStart: futureSlot },
        appointment: { id: 'appt-b', status: 'confirmed', startTime: new Date(Date.now() + 86400000) },
      },
      {
        id: 'older',
        patientId: 'patient-a',
        appointmentId: 'appt-a',
        openSlotEvent: { status: OPEN_SLOT_STATUS.FILLED, slotStart: futureSlot },
        appointment: { id: 'appt-a', status: 'confirmed', startTime: new Date(Date.now() + 86400000) },
      },
    ]

    expect(pickActiveSlotFillAttemptForTest(attempts)?.id).toBe('newer')
  })

  it('skips offers whose slot is in the past', () => {
    const attempts: Attempt[] = [
      {
        id: 'past',
        patientId: 'patient-a',
        appointmentId: 'appt-a',
        openSlotEvent: { status: OPEN_SLOT_STATUS.OPEN, slotStart: new Date(Date.now() - 1000) },
        appointment: { id: 'appt-a', status: 'confirmed', startTime: new Date(Date.now() + 86400000) },
      },
    ]

    expect(pickActiveSlotFillAttemptForTest(attempts)).toBeNull()
  })
})
