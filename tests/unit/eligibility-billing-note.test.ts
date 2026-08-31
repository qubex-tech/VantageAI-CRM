import { describe, expect, it } from 'vitest'
import {
  formatEligibilityBillingNote,
  patientDisplayName,
} from '@/lib/eligibility/eligibility-billing-note'
import type { ParsedEligibilitySummary } from '@/lib/availity'

const summary: ParsedEligibilitySummary = {
  eligibilityStatus: 'active',
  planStatus: 'Active Coverage',
  payerName: 'Florida Blue',
  payerId: 'BCBSF',
  groupNumber: 'GRP001',
  planName: 'PPO Gold',
  planType: 'PPO',
  coverageStartDate: '2024-01-01',
  benefits: [{ name: 'Office Visit', status: 'Active Coverage' }],
  validationMessages: [],
  rawPlanCount: 1,
  rheum: {
    formMode: 'office_visit',
    source: 'stedi_api',
    memberStatus: 'Active Coverage',
    networkStatus: 'inn',
    planType: 'PPO',
    specialistCopay: '$40',
    deductible: { total: '$500', remaining: '$200' },
    coinsurance: '20%',
    oop: { max: '$3000', remaining: '$2100' },
    referralRequired: false,
    authRequired: true,
  },
}

describe('eligibility billing note', () => {
  it('builds a patient display name', () => {
    expect(patientDisplayName({ firstName: 'Jane', lastName: 'Doe', name: 'Legacy' })).toBe(
      'Jane Doe'
    )
    expect(patientDisplayName({ name: 'Legacy Only' })).toBe('Legacy Only')
  })

  it('formats eligibility results as a billing note with full packet fields', () => {
    const note = formatEligibilityBillingNote({
      summary,
      payerNameRaw: 'BCBS',
      checkedAt: new Date('2026-08-21T16:00:00Z'),
      sourceLabel: 'Availity',
      timeZone: 'America/Chicago',
      patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1980-04-12' },
      policy: {
        memberId: 'ZGP814392947',
        groupNumber: 'GRP001',
        planName: 'PPO Gold',
        planType: 'PPO',
        isPrimary: true,
      },
    })

    expect(note).toContain('Eligibility / Billing Note (Availity)')
    expect(note).toContain('Status: Active')
    expect(note).toContain('Patient: Jane Doe')
    expect(note).toContain('Date of birth: 1980-04-12')
    expect(note).toContain('Member ID: ZGP814392947')
    expect(note).toContain('Policy: Primary')
    expect(note).toContain('Payer: Florida Blue')
    expect(note).toContain('Specialist copay: $40')
    expect(note).toContain('Prior auth required: Yes')
    expect(note).toContain('Referral required: No')
    expect(note).toContain('Benefits')
    expect(note).not.toMatch(/stedi/i)
  })

  it('does not shift a UTC-midnight patient DOB when the practice is in Chicago', () => {
    const note = formatEligibilityBillingNote({
      summary,
      payerNameRaw: 'BCBS',
      checkedAt: new Date('2026-08-21T16:00:00Z'),
      sourceLabel: 'Availity',
      timeZone: 'America/Chicago',
      patient: {
        firstName: 'Ravina',
        lastName: 'Shetty',
        dateOfBirth: new Date('1980-06-14T00:00:00.000Z'),
      },
    })

    expect(note).toContain('Date of birth: 1980-06-14')
    expect(note).not.toContain('Jun 13, 1980')
    expect(note).not.toContain('1980-06-13')
  })
})
