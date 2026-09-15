import { describe, expect, it } from 'vitest'
import { extractCallData } from '@/lib/process-call-data'
import {
  extractRecordsRequest,
  formatRecordsRequestCommlogLines,
  hasRecordsRequestToOtherOfficeInMetadata,
  hasRecordsRequestToPatientInMetadata,
} from '@/lib/retell-records-request'
import type { RetellCall } from '@/lib/retell-api'

const OTHER_OFFICE_FIELDS = {
  'Records Request - Dental Office Name': 'Bright Smile Dental',
  'Records Request - Dental Office Phone Number': '5125550199',
  'Records Request - Dental Office Email': 'records@brightsmile.example',
  'Records Request - Next Appointment Date With Other Dental Office': '2026-10-02',
}

describe('extractRecordsRequest', () => {
  it('reads email-to-patient when true', () => {
    expect(
      extractRecordsRequest([{ 'Records Request - Email To Patient': true }])
    ).toEqual({ emailToPatient: true })
    expect(
      extractRecordsRequest([{ records_request_email_to_patient: 'yes' }])
    ).toEqual({ emailToPatient: true })
  })

  it('ignores false or blank email-to-patient when no other office is given', () => {
    expect(
      extractRecordsRequest([{ 'Records Request - Email To Patient': false }])
    ).toBeUndefined()
    expect(
      extractRecordsRequest([{ 'Records Request - Email To Patient': '' }])
    ).toBeUndefined()
    expect(extractRecordsRequest([{ 'Call Reason': 'hours' }])).toBeUndefined()
  })

  it('reads other-office destination fields and skips blanks', () => {
    expect(
      extractRecordsRequest([
        {
          ...OTHER_OFFICE_FIELDS,
          'Records Request - Email To Patient': false,
          'Records Request - Dental Office Email': '  ',
        },
      ])
    ).toEqual({
      dentalOfficeName: 'Bright Smile Dental',
      dentalOfficePhoneNumber: '5125550199',
      nextAppointmentDate: '2026-10-02',
    })
  })

  it('can capture both email-to-patient and other-office destination', () => {
    expect(
      extractRecordsRequest([
        {
          'Records Request - Email To Patient': true,
          ...OTHER_OFFICE_FIELDS,
        },
      ])
    ).toEqual({
      emailToPatient: true,
      dentalOfficeName: 'Bright Smile Dental',
      dentalOfficePhoneNumber: '5125550199',
      dentalOfficeEmail: 'records@brightsmile.example',
      nextAppointmentDate: '2026-10-02',
    })
  })

  it('formats commlog lines for staff', () => {
    const data = extractRecordsRequest([
      {
        'Records Request - Email To Patient': true,
        ...OTHER_OFFICE_FIELDS,
      },
    ])
    expect(formatRecordsRequestCommlogLines(data!)).toEqual([
      'Records Request - Email To Patient: Yes',
      'Records Request - Dental Office Name: Bright Smile Dental',
      'Records Request - Dental Office Phone Number: 5125550199',
      'Records Request - Dental Office Email: records@brightsmile.example',
      'Records Request - Next Appointment Date With Other Dental Office: 2026-10-02',
    ])
  })
})

describe('records request metadata flags', () => {
  it('flags email to patient vs other office independently', () => {
    expect(
      hasRecordsRequestToPatientInMetadata({
        retell_custom_data: { 'Records Request - Email To Patient': true },
      })
    ).toBe(true)
    expect(
      hasRecordsRequestToOtherOfficeInMetadata({
        retell_custom_data: { 'Records Request - Email To Patient': true },
      })
    ).toBe(false)
    expect(
      hasRecordsRequestToOtherOfficeInMetadata({
        retell_custom_data: OTHER_OFFICE_FIELDS,
      })
    ).toBe(true)
    expect(
      hasRecordsRequestToPatientInMetadata({
        retell_custom_data: OTHER_OFFICE_FIELDS,
      })
    ).toBe(false)
    expect(hasRecordsRequestToPatientInMetadata(null)).toBe(false)
  })
})

describe('extractCallData records request', () => {
  it('maps custom_analysis_data records request fields onto ExtractedCallData', () => {
    const extracted = extractCallData({
      call_id: 'call_1',
      call_analysis: {
        custom_analysis_data: {
          'Records Request - Email To Patient': true,
          ...OTHER_OFFICE_FIELDS,
        },
      },
    } as RetellCall)

    expect(extracted.records_request).toEqual({
      emailToPatient: true,
      dentalOfficeName: 'Bright Smile Dental',
      dentalOfficePhoneNumber: '5125550199',
      dentalOfficeEmail: 'records@brightsmile.example',
      nextAppointmentDate: '2026-10-02',
    })
  })

  it('does not attach records_request on ordinary calls', () => {
    const extracted = extractCallData({
      call_id: 'call_2',
      call_analysis: {
        custom_analysis_data: {
          'Patient First Name': 'Jane',
          'Call Reason': 'Schedule cleaning',
        },
      },
    } as RetellCall)

    expect(extracted.records_request).toBeUndefined()
  })
})
