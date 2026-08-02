import { describe, expect, it } from 'vitest'
import {
  expectedPayerTokens,
  interpretAvailityEligibilityText,
  payerLabelMatches,
  payerSearchTerms,
} from '../playbooks/availity-eligibility'

describe('payerSearchTerms', () => {
  it('derives typeahead variants from any payer label (no hardcoded payer list)', () => {
    const terms = payerSearchTerms('Cigna Health spring')
    expect(terms[0]).toBe('Cigna Health spring')
    expect(terms.some((t) => /healthspring/i.test(t))).toBe(true)
    expect(terms).toContain('Cigna')
  })

  it('includes payer id when provided', () => {
    expect(payerSearchTerms('Acme Care', 'ABC123')).toContain('ABC123')
  })

  it('works for unrelated commercial payers', () => {
    const terms = payerSearchTerms('Humana Gold Plus')
    expect(terms[0]).toBe('Humana Gold Plus')
    expect(terms).toContain('Humana')
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
})
