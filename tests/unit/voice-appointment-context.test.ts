import { describe, it, expect } from 'vitest'
import {
  cleanAppointmentNoteForVoice,
  formatAppointmentForVoice,
} from '@/lib/appointments/voice-context'

describe('voice appointment notes for Retell', () => {
  it('strips Open Dental sync prefixes from notes', () => {
    expect(
      cleanAppointmentNoteForVoice(
        'Synced from Open Dental Appointment/72434 — Amir: Tooth pain'
      )
    ).toBe('Amir: Tooth pain')
    expect(cleanAppointmentNoteForVoice('Synced from Open Dental Appointment/72434')).toBeUndefined()
    expect(cleanAppointmentNoteForVoice(null)).toBeUndefined()
  })

  it('includes cleaned notes on get_upcoming_appointments-shaped output', () => {
    const formatted = formatAppointmentForVoice({
      id: 'apt-1',
      status: 'scheduled',
      startTime: new Date('2026-07-23T19:00:00.000Z'),
      endTime: new Date('2026-07-23T19:30:00.000Z'),
      timezone: 'America/Chicago',
      visitType: 'Open Dental Appointment',
      reason: null,
      providerId: 'NT',
      notes: 'Synced from Open Dental Appointment/72434 — Amir: Tooth pain',
    })

    expect(formatted.notes).toBe('Amir: Tooth pain')
    expect(formatted.summary).toContain('Thursday, July 23 at 2:00 PM')
    expect(formatted.summary).toContain('Note: Amir: Tooth pain')
  })
})
