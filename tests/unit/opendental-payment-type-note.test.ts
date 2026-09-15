import { describe, expect, it } from 'vitest'
import {
  buildCommlogNote,
  buildOpenDentalAppointmentNote,
  extractPaymentTypeFromNote,
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

  it('appends Payment type to appointment notes for new patients only by default', () => {
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

  it('can force Payment type onto notes when carrying from a prior appointment', () => {
    expect(
      buildOpenDentalAppointmentNote({
        reason: 'regular checkup and cleaning',
        paymentType: 'insurance',
        isNewPatient: false,
        applyPaymentType: true,
      })
    ).toBe('regular checkup and cleaning\nPayment type: insurance')
  })

  it('extracts Payment type from existing notes', () => {
    expect(extractPaymentTypeFromNote('checkup\nPayment type: insurance')).toBe('insurance')
    expect(
      extractPaymentTypeFromNote(
        'Synced from Open Dental Appointment/72459 — regular checkup and cleaning\r\nPayment type: self pay'
      )
    ).toBe('self pay')
    expect(extractPaymentTypeFromNote('checkup only')).toBeNull()
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
    expect(newPatientNote).not.toContain('Transcript:')
    expect(newPatientNote).not.toContain('hello')

    const existingNote = buildCommlogNote(call, {
      call_reason: 'Check appointment',
      call_summary: 'Confirmed upcoming visit',
      patient_type: 'existing patient',
      payment_type: 'insurance',
      user_phone_number: '+16309652880',
    })
    expect(existingNote).not.toContain('Payment type:')
  })

  it('includes collected insurance info update fields in the commlog', () => {
    const call = { transcript: 'hello' } as RetellCall
    const note = buildCommlogNote(call, {
      call_reason: 'Update insurance',
      call_summary: 'Caller provided new dental insurance details',
      patient_type: 'existing patient',
      retell_custom_data: {
        'Insurance Policy Holder Name': 'Jane Doe',
        'Insurance Policy Holder DOB': '1986-04-12',
        'Dental Insurance Provider': 'Delta Dental',
        'Insurance Member ID': 'XYZ123',
        'Insurance Group Number': 'GRP-9',
        'Dental Insurance Phone Number': '8005550100',
        'Dental Insurance Claim Mailing Address': '123 Claim St, Austin, TX',
      },
    })

    expect(note).toContain('Insurance info update')
    expect(note).toContain('Insurance Policy Holder Name: Jane Doe')
    expect(note).toContain('Insurance Policy Holder DOB: 1986-04-12')
    expect(note).toContain('Dental Insurance Provider: Delta Dental')
    expect(note).toContain('Insurance Member ID: XYZ123')
    expect(note).toContain('Insurance Group Number: GRP-9')
    expect(note).toContain('Dental Insurance Phone Number: 8005550100')
    expect(note).toContain('Dental Insurance Claim Mailing Address: 123 Claim St, Austin, TX')
    expect(note).not.toContain('Transcript:')
  })

  it('omits the insurance info update section when those fields were not collected', () => {
    const note = buildCommlogNote({ transcript: 'hello' } as RetellCall, {
      call_reason: 'Check appointment',
      call_summary: 'Confirmed upcoming visit',
    })
    expect(note).not.toContain('Insurance info update')
    expect(note).not.toContain('Insurance Member ID:')
    expect(note).not.toContain('Medical history update')
    expect(note).not.toContain('Updated Medications:')
    expect(note).not.toContain('Records request')
    expect(note).not.toContain('Records Request - Email To Patient:')
  })

  it('includes collected medical history, medication, and allergy updates in the commlog', () => {
    const note = buildCommlogNote({ transcript: 'hello' } as RetellCall, {
      call_reason: 'Update medical history',
      call_summary: 'Caller reported new medications and an allergy',
      patient_type: 'existing patient',
      retell_custom_data: {
        'Updated Medications': 'Started lisinopril 10mg daily; discontinued ibuprofen',
        'Updated Medical History': 'Recently diagnosed with hypertension',
        'Updated Allergies': 'Penicillin — rash',
      },
    })

    expect(note).toContain('Medical history update')
    expect(note).toContain(
      'Updated Medications: Started lisinopril 10mg daily; discontinued ibuprofen'
    )
    expect(note).toContain('Updated Medical History: Recently diagnosed with hypertension')
    expect(note).toContain('Updated Allergies: Penicillin — rash')
    expect(note).not.toContain('Transcript:')
  })

  it('includes only the medical history fields that were discussed', () => {
    const note = buildCommlogNote({ transcript: 'hello' } as RetellCall, {
      call_reason: 'Allergy update',
      call_summary: 'Caller reported a new allergy',
      retell_custom_data: {
        'Updated Medications': '',
        'Updated Allergies': 'Latex',
      },
    })

    expect(note).toContain('Medical history update')
    expect(note).toContain('Updated Allergies: Latex')
    expect(note).not.toContain('Updated Medications:')
    expect(note).not.toContain('Updated Medical History:')
  })

  it('includes records emailed to the patient in the commlog', () => {
    const note = buildCommlogNote({ transcript: 'hello' } as RetellCall, {
      call_reason: 'Request records',
      call_summary: 'Patient asked for records emailed to them',
      retell_custom_data: { 'Records Request - Email To Patient': true },
    })

    expect(note).toContain('Records request')
    expect(note).toContain('Records Request - Email To Patient: Yes')
    expect(note).not.toContain('Records Request - Dental Office Name:')
    expect(note).not.toContain('Transcript:')
  })

  it('includes records requested for another dental office in the commlog', () => {
    const note = buildCommlogNote({ transcript: 'hello' } as RetellCall, {
      call_reason: 'Transfer records',
      call_summary: 'Send x-rays to another office',
      retell_custom_data: {
        'Records Request - Email To Patient': false,
        'Records Request - Dental Office Name': 'Bright Smile Dental',
        'Records Request - Dental Office Phone Number': '5125550199',
        'Records Request - Dental Office Email': 'records@brightsmile.example',
        'Records Request - Next Appointment Date With Other Dental Office': '2026-10-02',
      },
    })

    expect(note).toContain('Records request')
    expect(note).not.toContain('Records Request - Email To Patient:')
    expect(note).toContain('Records Request - Dental Office Name: Bright Smile Dental')
    expect(note).toContain('Records Request - Dental Office Phone Number: 5125550199')
    expect(note).toContain('Records Request - Dental Office Email: records@brightsmile.example')
    expect(note).toContain(
      'Records Request - Next Appointment Date With Other Dental Office: 2026-10-02'
    )
  })
})
