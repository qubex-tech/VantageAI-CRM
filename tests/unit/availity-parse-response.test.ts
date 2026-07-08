import { describe, expect, it } from 'vitest'
import { parseEligibilityResponse, formatEligibilityNoteContent } from '@/lib/availity/parse-response'
import type { AvailityCoverageRecord } from '@/lib/availity/types'

const activeCoverage: AvailityCoverageRecord = {
  id: 'cov-1',
  status: 'Complete',
  statusCode: '4',
  payer: { payerId: 'BCBSF', name: 'Florida Blue' },
  plans: [
    {
      status: 'Active Coverage',
      statusCode: '1',
      groupNumber: 'GRP001',
      description: 'PPO Gold',
      coverageStartDate: '2024-01-01T00:00:00.000+0000',
      benefits: [{ name: 'Health Benefit Plan Coverage', status: 'Active Coverage' }],
    },
  ],
  validationMessages: [],
}

const inactiveCoverage: AvailityCoverageRecord = {
  status: 'Complete',
  statusCode: '4',
  plans: [{ status: 'Inactive', statusCode: '6' }],
}

const errorCoverage: AvailityCoverageRecord = {
  status: 'Request Error',
  statusCode: '19',
  validationMessages: [{ errorMessage: 'Invalid member ID' }],
}

describe('parseEligibilityResponse', () => {
  it('parses active coverage', () => {
    const summary = parseEligibilityResponse(activeCoverage)
    expect(summary.eligibilityStatus).toBe('active')
    expect(summary.payerName).toBe('Florida Blue')
    expect(summary.groupNumber).toBe('GRP001')
    expect(summary.benefits.length).toBeGreaterThan(0)
  })

  it('parses inactive coverage', () => {
    const summary = parseEligibilityResponse(inactiveCoverage)
    expect(summary.eligibilityStatus).toBe('inactive')
  })

  it('parses payer validation errors', () => {
    const summary = parseEligibilityResponse(errorCoverage)
    expect(summary.eligibilityStatus).toBe('error')
    expect(summary.validationMessages).toContain('Invalid member ID')
  })
})

describe('formatEligibilityNoteContent', () => {
  it('formats a readable note', () => {
    const summary = parseEligibilityResponse(activeCoverage)
    const note = formatEligibilityNoteContent({
      summary,
      payerNameRaw: 'BCBS',
      checkedAt: new Date('2026-07-07T12:00:00Z'),
    })
    expect(note).toContain('Insurance Eligibility (Availity)')
    expect(note).toContain('Status: active')
    expect(note).toContain('Benefits')
  })
})
