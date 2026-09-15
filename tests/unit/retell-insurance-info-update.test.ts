import { describe, expect, it } from 'vitest'
import { extractCallData } from '@/lib/process-call-data'
import {
  extractInsuranceInfoUpdate,
  formatInsuranceInfoUpdateCommlogLines,
  hasInsuranceInfoUpdateInMetadata,
} from '@/lib/retell-insurance-info-update'
import type { RetellCall } from '@/lib/retell-api'

const SAMPLE_FIELDS = {
  'Insurance Policy Holder Name': 'Jane Doe',
  'Insurance Policy Holder DOB': '1986-04-12',
  'Dental Insurance Provider': 'Delta Dental',
  'Insurance Member ID': 'XYZ123',
  'Insurance Group Number': 'GRP-9',
  'Dental Insurance Phone Number': '8005550100',
  'Dental Insurance Claim Mailing Address': '123 Claim St, Austin, TX',
}

describe('extractInsuranceInfoUpdate', () => {
  it('reads Retell display-name keys', () => {
    expect(extractInsuranceInfoUpdate([SAMPLE_FIELDS])).toEqual({
      policyHolderName: 'Jane Doe',
      policyHolderDob: '1986-04-12',
      dentalInsuranceProvider: 'Delta Dental',
      memberId: 'XYZ123',
      groupNumber: 'GRP-9',
      dentalInsurancePhoneNumber: '8005550100',
      claimMailingAddress: '123 Claim St, Austin, TX',
    })
  })

  it('reads normalized / snake_case keys and skips empty values', () => {
    expect(
      extractInsuranceInfoUpdate([
        {
          insurance_member_id: 'ABC',
          'Insurance Group Number': '  ',
          dental_insurance_provider: 'Aetna',
        },
      ])
    ).toEqual({
      memberId: 'ABC',
      dentalInsuranceProvider: 'Aetna',
    })
  })

  it('returns undefined when no insurance-update fields are present', () => {
    expect(extractInsuranceInfoUpdate([undefined, { 'Call Reason': 'hours' }])).toBeUndefined()
    expect(extractInsuranceInfoUpdate([{}])).toBeUndefined()
  })

  it('formats commlog lines with original Retell labels', () => {
    const data = extractInsuranceInfoUpdate([SAMPLE_FIELDS])
    expect(data).toBeDefined()
    expect(formatInsuranceInfoUpdateCommlogLines(data!)).toEqual([
      'Insurance Policy Holder Name: Jane Doe',
      'Insurance Policy Holder DOB: 1986-04-12',
      'Dental Insurance Provider: Delta Dental',
      'Insurance Member ID: XYZ123',
      'Insurance Group Number: GRP-9',
      'Dental Insurance Phone Number: 8005550100',
      'Dental Insurance Claim Mailing Address: 123 Claim St, Austin, TX',
    ])
  })
})

describe('hasInsuranceInfoUpdateInMetadata', () => {
  it('detects fields on retell_custom_data or structured insurance_info_update', () => {
    expect(hasInsuranceInfoUpdateInMetadata({ retell_custom_data: SAMPLE_FIELDS })).toBe(true)
    expect(
      hasInsuranceInfoUpdateInMetadata({
        insurance_info_update: { memberId: 'XYZ123' },
      })
    ).toBe(true)
    expect(hasInsuranceInfoUpdateInMetadata({ call_summary: 'Asked about hours' })).toBe(false)
    expect(hasInsuranceInfoUpdateInMetadata(null)).toBe(false)
  })
})

describe('extractCallData insurance info update', () => {
  it('maps custom_analysis_data insurance fields onto ExtractedCallData', () => {
    const extracted = extractCallData({
      call_id: 'call_1',
      call_analysis: { custom_analysis_data: SAMPLE_FIELDS },
    } as RetellCall)

    expect(extracted.insurance_info_update).toEqual({
      policyHolderName: 'Jane Doe',
      policyHolderDob: '1986-04-12',
      dentalInsuranceProvider: 'Delta Dental',
      memberId: 'XYZ123',
      groupNumber: 'GRP-9',
      dentalInsurancePhoneNumber: '8005550100',
      claimMailingAddress: '123 Claim St, Austin, TX',
    })
  })

  it('does not attach insurance_info_update on ordinary calls', () => {
    const extracted = extractCallData({
      call_id: 'call_2',
      call_analysis: {
        custom_analysis_data: {
          'Patient First Name': 'Jane',
          'Call Reason': 'Schedule cleaning',
        },
      },
    } as RetellCall)

    expect(extracted.insurance_info_update).toBeUndefined()
  })
})
