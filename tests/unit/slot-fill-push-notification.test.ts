import { describe, expect, it } from 'vitest'
import { buildSlotFillOutreachPushMessage } from '@/lib/appointment-optimization/slotFillPushNotification'

describe('buildSlotFillOutreachPushMessage', () => {
  it('builds a slot_fill push payload with patient and slot context', () => {
    const slotStart = new Date('2026-07-10T19:00:00.000Z')
    const message = buildSlotFillOutreachPushMessage({
      practiceId: 'practice-1',
      openSlotEventId: 'slot-1',
      outreachAttemptId: 'attempt-1',
      patientName: 'Jane Doe',
      slotStart,
      providerId: 'Practitioner/abc',
      waveNumber: 2,
      messagePreview: 'Hi Jane — an earlier slot opened',
      timezone: 'America/Chicago',
    })

    expect(message.title).toBe('📅 Slot fill text sent')
    expect(message.body).toContain('To Jane')
    expect(message.body).toContain('Wave 2')
    expect(message.data).toEqual({
      type: 'slot_fill',
      openSlotEventId: 'slot-1',
      outreachAttemptId: 'attempt-1',
      waveNumber: 2,
    })
  })
})
