import { describe, expect, it } from 'vitest'
import type { ParsedEligibilitySummary } from '@/lib/availity/types'
import {
  buildEligibilityDisplaySnapshot,
  formatCoinsuranceSplit,
  formatDeductibleDisplay,
  formatEligibilityActivityDescription,
  formatOopDisplay,
  LONESTAR_DEFAULT_DISPLAY_FIELDS,
  parseDisplayFieldsConfig,
} from '../display-fields'
import { formatEligibilityBillingNote } from '../eligibility-billing-note'

const summary: ParsedEligibilitySummary = {
  eligibilityStatus: 'active',
  planStatus: 'Active Coverage',
  payerName: 'Aetna',
  planType: 'PPO',
  benefits: [],
  validationMessages: [],
  rawPlanCount: 1,
  rheum: {
    formMode: 'office_visit',
    source: 'stedi_api',
    memberStatus: 'Active Coverage',
    networkStatus: 'inn',
    planType: 'PPO',
    specialistCopay: '$40.00',
    deductible: { total: '$500.00', remaining: '$0.00' },
    coinsurance: '20%',
    oop: { max: '$3000.00', remaining: '$2100.00' },
    referralRequired: true,
  },
}

describe('eligibility display fields', () => {
  it('formats coinsurance as plan/patient split', () => {
    expect(formatCoinsuranceSplit('20%')).toBe('80/20')
    expect(formatCoinsuranceSplit('0%')).toBe('100/0')
    expect(formatCoinsuranceSplit('50%')).toBe('50/50')
    expect(formatCoinsuranceSplit('80/20')).toBe('80/20')
    expect(formatCoinsuranceSplit(undefined)).toBeUndefined()
  })

  it('treats $0 remaining deductible as Met', () => {
    expect(formatDeductibleDisplay(summary.rheum)).toBe('Met')
    expect(
      formatDeductibleDisplay({
        ...summary.rheum!,
        deductible: { total: '$500.00', remaining: '$250.00' },
      })
    ).toBe('Still owed $250.00')
    expect(formatDeductibleDisplay({ ...summary.rheum!, deductible: { total: '$500.00' } })).toBeUndefined()
  })

  it('formats OOP remaining or Met', () => {
    expect(formatOopDisplay(summary.rheum)).toBe('$2100.00 remaining')
    expect(
      formatOopDisplay({
        ...summary.rheum!,
        oop: { max: '$3000.00', remaining: '$0' },
      })
    ).toBe('Met')
  })

  it('builds a Lonestar snapshot with Unknown for missing values', () => {
    const snapshot = buildEligibilityDisplaySnapshot(
      {
        ...summary,
        rheum: {
          ...summary.rheum!,
          planType: undefined,
          referralRequired: null,
        },
        planType: undefined,
      },
      LONESTAR_DEFAULT_DISPLAY_FIELDS
    )
    expect(snapshot?.fields.find((f) => f.id === 'plan_status')?.value).toBe('Active')
    expect(snapshot?.fields.find((f) => f.id === 'network')?.value).toBe('Participating')
    expect(snapshot?.fields.find((f) => f.id === 'plan_type')?.value).toBe('Unknown')
    expect(snapshot?.fields.find((f) => f.id === 'referral_required')?.value).toBe('Unknown')
    expect(snapshot?.fields.find((f) => f.id === 'copay')?.value).toBe('$40.00')
    expect(snapshot?.fields.find((f) => f.id === 'deductible')?.value).toBe('Met')
    expect(snapshot?.fields.find((f) => f.id === 'coinsurance')?.value).toBe('80/20')
    expect(snapshot?.fields.find((f) => f.id === 'oop')?.value).toBe('$2100.00 remaining')
  })

  it('passes payer auth notes through Referral required when there is no yes/no', () => {
    const snapshot = buildEligibilityDisplaySnapshot(
      {
        ...summary,
        rheum: {
          ...summary.rheum!,
          referralRequired: null,
          referralNote:
            'A prior authorization or notification inquiry request may be submitted.',
        },
      },
      LONESTAR_DEFAULT_DISPLAY_FIELDS
    )
    expect(snapshot?.fields.find((f) => f.id === 'referral_required')?.value).toBe(
      'A prior authorization or notification inquiry request may be submitted.'
    )
  })

  it('keeps an explicit referral Yes instead of the payer note', () => {
    const snapshot = buildEligibilityDisplaySnapshot(
      {
        ...summary,
        rheum: {
          ...summary.rheum!,
          referralRequired: true,
          referralNote:
            'A prior authorization or notification inquiry request may be submitted.',
        },
      },
      LONESTAR_DEFAULT_DISPLAY_FIELDS
    )
    expect(snapshot?.fields.find((f) => f.id === 'referral_required')?.value).toBe('Yes')
  })

  it('freezes CRM lines in activity copy', () => {
    const snapshot = buildEligibilityDisplaySnapshot(summary, {
      fields: [
        { id: 'plan_status', crm: true, ehr: false },
        { id: 'coinsurance', crm: true, ehr: true },
        { id: 'copay', crm: false, ehr: true },
      ],
    })
    const description = formatEligibilityActivityDescription({
      eligibilityStatus: 'active',
      checkedAtLabel: 'Nov 21, 2026, 2:00 PM',
      snapshot,
    })
    expect(description).toContain('active — Nov 21, 2026, 2:00 PM')
    expect(description).toContain('Plan status: Active')
    expect(description).toContain('Coinsurance: 80/20')
    expect(description).not.toContain('Specialist copay')
  })

  it('writes only selected EHR fields into the chart note', () => {
    const snapshot = buildEligibilityDisplaySnapshot(summary, {
      fields: [
        { id: 'network', crm: true, ehr: true },
        { id: 'coinsurance', crm: true, ehr: true },
        { id: 'copay', crm: true, ehr: false },
      ],
    })
    const note = formatEligibilityBillingNote({
      summary: { ...summary, displaySnapshot: snapshot || undefined },
      payerNameRaw: 'Aetna',
      checkedAt: new Date('2026-11-21T20:00:00Z'),
      sourceLabel: null,
      timeZone: 'America/Chicago',
      patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1980-04-12' },
      policy: { memberId: 'AETNA123' },
    })
    expect(note).toContain('Patient: Jane Doe')
    expect(note).toContain('Network: Participating')
    expect(note).toContain('Coinsurance: 80/20')
    expect(note).not.toContain('Specialist copay')
    expect(note).not.toContain('All benefits from payer')
    expect(note).not.toMatch(/stedi/i)
  })

  it('parses stored JSON and fills missing catalog rows as off', () => {
    const parsed = parseDisplayFieldsConfig({
      fields: [{ id: 'copay', crm: true, ehr: false }],
    })
    expect(parsed?.fields.find((f) => f.id === 'copay')).toEqual({
      id: 'copay',
      crm: true,
      ehr: false,
    })
    expect(parsed?.fields.find((f) => f.id === 'network')).toEqual({
      id: 'network',
      crm: false,
      ehr: false,
    })
    expect(parsed?.fields).toHaveLength(8)
  })
})
