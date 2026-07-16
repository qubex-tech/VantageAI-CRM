import { describe, expect, it } from 'vitest'
import {
  buildCommlogNote,
  buildOpenDentalAppointmentNote,
  isRetellNewPatientCall,
  normalizeRetellPaymentType,
} from '@/lib/integrations/opendental/commlogWriteback'
import type { ExtractedCallData } from '@/lib/process-call-data'
import type { RetellCall } from '@/lib/retell-api'

describe('Retell payment type for Open Dental notes', () => {
  it('normalizes Retell Payment Type to insurance or self pay', () => {
    expect(normalizeRetellPaymentType('insurance')).toBe('insurance')
    expect(normalizeRetellPaymentType('Insurance')).toBe('insurance')
    expect(normalizeRetellPaymentType('Dental insurance')).toBe('insurance')
    expect(normalizeRetellPaymentType('self pay')).toBe('self pay')
    expect(normalizeRetellPaymentType('self-pay')).toBe('self pay')
    expect(normalizeRetellPaymentType('Self Pay')).toBe('self pay')
    expect(normalizeRetellPaymentType('')).toBeNull()
    expect(normalizeRetellPaymentType('unknown')).toBeNull()
  })

  it('detects new patient calls from Retell flags', () => {
    expect(
      isRetellNewPatientCall({ new_patient_add: true } as ExtractedCallData)
    ).toBe(true)
    expect(
      isRetellNewPatientCall({ patient_type: 'new patient' } as ExtractedCallData)
    ).toBe(true)
    expect(
      isRetellNewPatientCall({ patient_type: 'existing patient' } as ExtractedCallData)
    ).toBe(false)
  })

  it('appends Payment type to appointment notes for new patients only', () => {
    expect(
      buildOpenDentalAppointmentNote({
        reason: 'new patient exam and cleaning',
        paymentType: 'insurance',
        isNewPatient: true,
      })
    ).toBe('new patient exam and cleaning\nPayment type: insurance')

    expect(
      buildOpenDentalAppointmentNote({
        reason: 'tooth pain',
        paymentType: 'self pay',
        isNewPatient: false,
      })
    ).toBe('tooth pain')

    expect(
      buildOpenDentalAppointmentNote({
        reason: 'checkup\nPayment type: self pay',
        paymentType: 'self pay',
        isNewPatient: true,
      })
    ).toBe('checkup\nPayment type: self pay')

    expect(
      buildOpenDentalAppointmentNote({
        reason: 'checkup\nPayment type: self pay',
        paymentType: 'Dental insurance',
        isNewPatient: true,
      })
    ).toBe('checkup\nPayment type: insurance')
  })

  it('includes Payment type in commlog notes for new patients only', () => {
    const call = { transcript: 'hello' } as RetellCall

    const newPatientNote = buildCommlogNote(call, {
      call_reason: 'Schedule a first-time dental appointment',
      call_summary: 'Booked a new patient visit',
      new_patient_add: true,
      payment_type: 'self pay',
      user_phone_number: '+16309652880',
    })
    expect(newPatientNote).toContain('Payment type: self pay')
    expect(newPatientNote).toContain('Reason: Schedule a first-time dental appointment')

    const existingNote = buildCommlogNote(call, {
      call_reason: 'Check appointment',
      call_summary: 'Confirmed upcoming visit',
      patient_type: 'existing patient',
      payment_type: 'insurance',
      user_phone_number: '+16309652880',
    })
    expect(existingNote).not.toContain('Payment type:')
  })
})
