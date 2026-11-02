import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import {
  buildNexhealthAppointmentExternalId,
  buildNexhealthPatientExternalId,
  buildNexhealthPatientMergeFilters,
  isNexhealthPlaceholderPatient,
  mapNexhealthAppointmentStatus,
  mapNexhealthPatient,
  nexhealthSlotWindows,
  parseNexhealthAppointmentId,
  parseNexhealthPatientId,
  verifyNexhealthWebhookSignature,
} from '@/lib/integrations/nexhealth/mapping'

describe('NexHealth identity mapping', () => {
  it('namespaces patient and appointment ids', () => {
    expect(buildNexhealthPatientExternalId(415)).toBe('nexhealth:415')
    expect(buildNexhealthAppointmentExternalId(1822)).toBe('nexhealth:apt:1822')
    expect(parseNexhealthPatientId('nexhealth:415')).toBe(415)
    expect(parseNexhealthPatientId('nexhealth:apt:1822')).toBeNull()
    expect(parseNexhealthAppointmentId('nexhealth:apt:1822')).toBe(1822)
    expect(parseNexhealthAppointmentId('opendental:apt:12')).toBeNull()
  })

  it('skips placeholder new-patient charts', () => {
    expect(isNexhealthPlaceholderPatient({ foreign_id: '123np' })).toBe(true)
    expect(isNexhealthPlaceholderPatient({ foreign_id: 'chart-44' })).toBe(false)
  })

  it('maps an inactive patient and keeps phone-only out of merge filters', () => {
    const mapped = mapNexhealthPatient({
      id: 9,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      inactive: true,
      bio: {
        phone_number: '5551112222',
        date_of_birth: '1815-12-10',
        gender: 'Female',
        city: 'London',
      },
    })
    expect(mapped.externalEhrId).toBe('nexhealth:9')
    expect(mapped.ehrActive).toBe(false)
    expect(mapped.gender).toBe('female')
    expect(mapped.primaryPhone).toBe('5551112222')
    expect(mapped.dateOfBirth?.toISOString().slice(0, 10)).toBe('1815-12-10')

    expect(
      buildNexhealthPatientMergeFilters({
        email: null,
        name: '',
        dateOfBirth: null,
        primaryPhone: '5551112222',
      })
    ).toEqual([])
    expect(buildNexhealthPatientMergeFilters(mapped)).toHaveLength(3)
  })

  it('maps appointment status and splits slot windows at 14 days', () => {
    expect(mapNexhealthAppointmentStatus({ cancelled: true, is_past: true })).toBe('cancelled')
    expect(mapNexhealthAppointmentStatus({ patient_missed: true })).toBe('no_show')
    expect(mapNexhealthAppointmentStatus({ is_past: true })).toBe('completed')
    expect(mapNexhealthAppointmentStatus({ confirmed: true })).toBe('confirmed')
    expect(mapNexhealthAppointmentStatus({})).toBe('scheduled')
    expect(nexhealthSlotWindows('2026-11-01', '2026-11-20').map((window) => window.days)).toEqual([
      14, 6,
    ])
  })

  it('accepts a valid webhook signature and rejects a mismatch', () => {
    const rawBody = '{"ok":true}'
    const timestamp = '2026-11-01T12:00:00.000Z'
    const secret = 'whsec_test'
    const encoded = Buffer.from(rawBody, 'utf8').toString('base64')
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${encoded}`)
      .digest('hex')

    expect(
      verifyNexhealthWebhookSignature({ rawBody, timestamp, signature, secret })
    ).toBe(true)
    expect(
      verifyNexhealthWebhookSignature({ rawBody, timestamp, signature: 'deadbeef', secret })
    ).toBe(false)
    expect(
      verifyNexhealthWebhookSignature({
        rawBody: '{"ok":false}',
        timestamp,
        signature,
        secret,
      })
    ).toBe(false)
  })
})
