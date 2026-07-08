import type { AvailityCoverageRecord, ParsedEligibilitySummary } from './types'

function normalizeActiveStatus(value?: string): boolean | null {
  const text = String(value || '').toLowerCase()
  if (!text) return null
  if (text.includes('inactive') || text.includes('terminated') || text.includes('not eligible')) {
    return false
  }
  if (text.includes('active') || text === '1') return true
  return null
}

export function parseEligibilityResponse(record: AvailityCoverageRecord): ParsedEligibilitySummary {
  const plans = Array.isArray(record.plans) ? record.plans : []
  const primaryPlan = plans[0]
  const validationMessages = (record.validationMessages || [])
    .map((m) => m.errorMessage || m.field || '')
    .filter(Boolean)

  let eligibilityStatus: ParsedEligibilitySummary['eligibilityStatus'] = 'unknown'
  if (validationMessages.length > 0) {
    eligibilityStatus = 'error'
  } else if (primaryPlan) {
    const active = normalizeActiveStatus(primaryPlan.status) ?? normalizeActiveStatus(primaryPlan.statusCode)
    if (active === true) eligibilityStatus = 'active'
    else if (active === false) eligibilityStatus = 'inactive'
  }

  const benefits = plans.flatMap((plan) =>
    (plan.benefits || []).map((benefit) => ({
      name: benefit.name || benefit.type || 'Benefit',
      status: benefit.status,
      detail: benefit.statusCode,
    }))
  )

  return {
    eligibilityStatus,
    planStatus: primaryPlan?.status,
    payerName: record.payer?.name || record.payer?.responseName,
    payerId: record.payer?.payerId || record.payer?.responsePayerId,
    groupNumber: primaryPlan?.groupNumber,
    planName: primaryPlan?.description || primaryPlan?.groupName,
    coverageStartDate: primaryPlan?.coverageStartDate,
    coverageEndDate: primaryPlan?.coverageEndDate,
    eligibilityStartDate: primaryPlan?.eligibilityStartDate,
    eligibilityEndDate: primaryPlan?.eligibilityEndDate,
    benefits,
    validationMessages,
    rawPlanCount: plans.length,
  }
}

export function formatEligibilityNoteContent(params: {
  summary: ParsedEligibilitySummary
  payerNameRaw?: string
  checkedAt?: Date
}): string {
  const { summary, payerNameRaw, checkedAt } = params
  const lines: string[] = ['Insurance Eligibility (Availity)']

  if (checkedAt) {
    lines.push(`Checked at: ${checkedAt.toLocaleString()}`)
  }
  lines.push(`Status: ${summary.eligibilityStatus}`)
  if (summary.payerName || payerNameRaw) {
    lines.push(`Payer: ${summary.payerName || payerNameRaw}`)
  }
  if (summary.planName) lines.push(`Plan: ${summary.planName}`)
  if (summary.groupNumber) lines.push(`Group #: ${summary.groupNumber}`)
  if (summary.coverageStartDate || summary.coverageEndDate) {
    lines.push(
      `Coverage period: ${[summary.coverageStartDate, summary.coverageEndDate].filter(Boolean).join(' – ')}`
    )
  }

  if (summary.benefits.length > 0) {
    lines.push('')
    lines.push('Benefits')
    for (const benefit of summary.benefits.slice(0, 10)) {
      lines.push(`- ${benefit.name}${benefit.status ? `: ${benefit.status}` : ''}`)
    }
  }

  if (summary.validationMessages.length > 0) {
    lines.push('')
    lines.push('Payer messages')
    for (const msg of summary.validationMessages) {
      lines.push(`- ${msg}`)
    }
  }

  return lines.join('\n')
}
