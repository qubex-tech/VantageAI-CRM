import { describe, expect, it } from 'vitest'
import {
  expectedPayerTokens,
  interpretAvailityEligibilityText,
  normalizePayerText,
  payerLabelMatches,
  payerSearchTerms,
  pickBestPayerLabel,
  scorePayerLabel,
} from '../playbooks/availity-eligibility'

describe('normalizePayerText', () => {
  it('collapses health care → Healthcare and strips Of All States noise', () => {
    expect(normalizePayerText('United Health Care Of All States')).toBe('United Healthcare')
  })
})

describe('payerSearchTerms', () => {
  it('derives typeahead variants from any payer label (no hardcoded payer list)', () => {
    const terms = payerSearchTerms('Cigna Health spring')
    // Short brand first — matches manual Availity typeahead usage.
    expect(terms[0]).toBe('Cigna')
    expect(terms.some((t) => /healthspring/i.test(t))).toBe(true)
    expect(terms).toContain('Cigna Health spring')
  })

  it('includes payer id when provided (preferred first)', () => {
    const terms = payerSearchTerms('Acme Care', 'ABC123')
    expect(terms[0]).toBe('ABC123')
    expect(terms).toContain('ABC123')
  })

  it('works for unrelated commercial payers', () => {
    const terms = payerSearchTerms('Humana Gold Plus')
    expect(terms[0]).toBe('Humana')
    expect(terms).toContain('Humana Gold Plus')
  })

  it('emits short brand then United Healthcare for messy CRM UHC labels', () => {
    const terms = payerSearchTerms('United Health Care Of All States')
    expect(terms[0]).toBe('United')
    expect(terms).toContain('United Healthcare')
    expect(terms.some((t) => /united\s+healthcare/i.test(t))).toBe(true)
  })
})

describe('expectedPayerTokens / payerLabelMatches', () => {
  it('matches HealthSpring-style compound labels from messy CRM text', () => {
    expect(payerLabelMatches('Cigna HealthSpring (Medicaid)', 'Cigna Health spring')).toBe(true)
  })

  it('rejects a sticky wrong payer', () => {
    expect(payerLabelMatches('AETNA (COMMERCIAL & MEDICARE)', 'Cigna Health spring')).toBe(false)
  })

  it('matches single-word payers dynamically', () => {
    expect(expectedPayerTokens('Aetna').length).toBeGreaterThan(0)
    expect(payerLabelMatches('AETNA (COMMERCIAL & MEDICARE)', 'Aetna')).toBe(true)
  })

  it('matches UNITED HEALTHCARE for United Health Care Of All States', () => {
    expect(payerLabelMatches('UNITED HEALTHCARE', 'United Health Care Of All States')).toBe(true)
    expect(payerLabelMatches('United Healthcare', 'United Health Care Of All States')).toBe(true)
  })

  it('matches Texas BCBS and rejects generic / non-Texas Blue Cross labels', () => {
    const crm = 'Blue Cross and Blue Shield of Texas'
    expect(payerLabelMatches('BLUE CROSS BLUE SHIELD OF TEXAS', crm)).toBe(true)
    expect(payerLabelMatches('Blue Cross and Blue Shield of Texas', crm)).toBe(true)
    expect(payerLabelMatches('Blue Cross', crm)).toBe(false)
    expect(payerLabelMatches('BLUE CROSS MEDICARE ADVANTAGE', crm)).toBe(false)
    expect(payerLabelMatches('BLUE CROSS OF WASHINGTON AND ALASKA (PREMERA)', crm)).toBe(false)
  })
})

describe('scorePayerLabel / pickBestPayerLabel', () => {
  it('prefers base UNITED HEALTHCARE over plan variants', () => {
    const crm = 'United Health Care Of All States'
    const best = pickBestPayerLabel(
      [
        'UNITED HEALTHCARE COMMUNITY PLAN TN',
        'UNITED HEALTHCARE',
        'UNITED HEALTHCARE OVATIONS(AARP)',
        'UNITED HEALTHCARE OXFORD',
      ],
      crm
    )
    expect(best?.toUpperCase()).toBe('UNITED HEALTHCARE')
    expect(scorePayerLabel('UNITED HEALTHCARE', crm)!).toBeGreaterThan(
      scorePayerLabel('UNITED HEALTHCARE COMMUNITY PLAN TN', crm)!
    )
  })

  it('prefers Texas BCBS over generic Blue Cross labels', () => {
    const crm = 'Blue Cross and Blue Shield of Texas'
    const best = pickBestPayerLabel(
      [
        'BLUE CROSS MEDICARE ADVANTAGE',
        'BLUE CROSS BLUE SHIELD OF TEXAS',
        'Blue Cross',
      ],
      crm
    )
    expect(best?.toUpperCase()).toContain('TEXAS')
  })
})

describe('interpretAvailityEligibilityText', () => {
  it('detects Invalid/Missing Subscriber AAA rejection', () => {
    const snippet = `
Eligibility & Benefits
Invalid/Missing Subscriber/Insured ID - Please Correct and Resubmit
Date of Service Aug 2, 2026
Transaction ID 77248045469
Submit another patient
Submit
`
    const result = interpretAvailityEligibilityText(snippet)
    expect(result.eligibilityStatus).toBe('error')
    expect(result.message).toMatch(/Invalid\/Missing Subscriber/i)
  })

  it('still detects active coverage when Submit another patient CTA is present', () => {
    const snippet = `
Coverage Status: Active
Specialist Copay: $40.00
Deductible: $500.00
Submit another patient
`
    expect(interpretAvailityEligibilityText(snippet).eligibilityStatus).toBe('active')
  })

  it('detects inactive coverage', () => {
    expect(
      interpretAvailityEligibilityText('Patient is not eligible. Coverage terminated.')
        .eligibilityStatus
    ).toBe('inactive')
  })

  it('does not treat another patient Active Coverage as success for this member', () => {
    const snippet = `
CORREA, KATHRYN Q
Member Status
Active Coverage
Member ID: 964461385
ZGP814392947
Health Benefit Plan Coverage
Invalid/Missing Subscriber/Insured ID - Please Correct and Resubmit
`
    expect(
      interpretAvailityEligibilityText(snippet, { memberId: 'ZGP814392947' }).eligibilityStatus
    ).toBe('error')
  })

  it('requires member-scoped Active Coverage when memberId is provided', () => {
    const stickyHistory = `
CORREA, KATHRYN Q
Member Status
Active Coverage
Member ID: 964461385
Get Started
Patient ID
`
    expect(
      interpretAvailityEligibilityText(stickyHistory, { memberId: 'ZGP814392947' })
        .eligibilityStatus
    ).toBe('unknown')
  })

  it('rejects Medicare Advantage for commercial BCBS Texas scoring', () => {
    const crm = 'Blue Cross and Blue Shield of Texas'
    expect(payerLabelMatches('BLUE CROSS MEDICARE ADVANTAGE', crm)).toBe(false)
    expect(pickBestPayerLabel(['BLUE CROSS MEDICARE ADVANTAGE', 'BLUE CROSS BLUE SHIELD OF TEXAS'], crm)).toBe(
      'BLUE CROSS BLUE SHIELD OF TEXAS'
    )
  })
})
