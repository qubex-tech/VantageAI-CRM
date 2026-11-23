import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EligibilityOvPanel } from '../EligibilityOvPanel'
import type { ParsedEligibilitySummary } from '@/lib/availity/types'

const summary: ParsedEligibilitySummary = {
  eligibilityStatus: 'active',
  planStatus: 'Active Coverage',
  payerName: 'UNITEDHEALTHCARE',
  planType: 'PPO',
  benefits: [],
  validationMessages: [],
  rawPlanCount: 1,
  displaySnapshot: {
    fields: [
      { id: 'plan_status', label: 'Plan status', value: 'Active', crm: true, ehr: true },
      {
        id: 'referral_required',
        label: 'Referral required',
        value: 'A prior authorization or notification inquiry request may be submitted.',
        crmValue:
          'Unknown\nA prior authorization or notification inquiry request may be submitted.',
        crm: true,
        ehr: true,
      },
      { id: 'copay', label: 'Specialist copay', value: '$10', crm: true, ehr: true },
    ],
  },
  coverageDetail: {
    payerName: 'UNITEDHEALTHCARE',
    planName: 'UHC Group Medicare Advantage',
    copays: [{ services: 'Office visit specialist', amount: '$10', network: 'N/A' }],
    benefitLines: [
      {
        category: 'Co-Payment',
        services: 'Office visit specialist',
        network: 'N/A',
        amount: '$10',
      },
    ],
  },
}

describe('EligibilityOvPanel', () => {
  it('shows the practice summary and the full payer snapshot together', () => {
    const html = renderToStaticMarkup(
      createElement(EligibilityOvPanel, { summary, compact: true })
    )
    expect(html).toContain('Key benefits')
    expect(html).toContain('Plan status')
    expect(html).toContain('Specialist copay')
    expect(html).toContain('Copays')
    expect(html).toContain('All benefits from payer')
    expect(html).toContain('UHC Group Medicare Advantage')
    expect(html).toContain('Unknown')
    expect(html).toContain('A prior authorization or notification inquiry request may be submitted.')
  })
})
