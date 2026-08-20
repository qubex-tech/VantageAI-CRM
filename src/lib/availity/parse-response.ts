import { buildRheumPacketFromAvailityPlans } from '@/lib/eligibility/parse-availity-amounts'
import { formatRheumPacketNoteSection } from '@/lib/eligibility/rheum-packet'
import type { AvailityCoverageRecord, EligibilityCoverageDetail, ParsedEligibilitySummary } from './types'

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

  const rheum =
    eligibilityStatus === 'error'
      ? undefined
      : buildRheumPacketFromAvailityPlans(plans, { formMode: 'office_visit', source: 'availity_api' })

  return {
    eligibilityStatus,
    planStatus: primaryPlan?.status,
    payerName: record.payer?.name || record.payer?.responseName,
    payerId: record.payer?.payerId || record.payer?.responsePayerId,
    groupNumber: primaryPlan?.groupNumber,
    planName: primaryPlan?.description || primaryPlan?.groupName,
    planType: rheum?.planType || primaryPlan?.insuranceType,
    coverageStartDate: primaryPlan?.coverageStartDate,
    coverageEndDate: primaryPlan?.coverageEndDate,
    eligibilityStartDate: primaryPlan?.eligibilityStartDate,
    eligibilityEndDate: primaryPlan?.eligibilityEndDate,
    benefits,
    validationMessages,
    rawPlanCount: plans.length,
    rheum,
  }
}

export function formatEligibilityNoteContent(params: {
  summary: ParsedEligibilitySummary
  payerNameRaw?: string
  checkedAt?: Date
  sourceLabel?: string | null
}): string {
  const { summary, payerNameRaw, checkedAt, sourceLabel = 'Availity' } = params
  const lines: string[] = [
    sourceLabel ? `Insurance Eligibility (${sourceLabel})` : 'Insurance Eligibility',
  ]

  if (checkedAt) {
    lines.push(`Checked at: ${checkedAt.toLocaleString()}`)
  }
  lines.push(`Status: ${summary.eligibilityStatus}`)
  if (!summary.coverageDetail) {
    if (summary.payerName || payerNameRaw) {
      lines.push(`Payer: ${summary.payerName || payerNameRaw}`)
    }
    if (summary.planName) lines.push(`Plan: ${summary.planName}`)
    if (summary.planType) lines.push(`Plan type: ${summary.planType}`)
    if (summary.groupNumber) lines.push(`Group #: ${summary.groupNumber}`)
    if (summary.coverageStartDate || summary.coverageEndDate) {
      lines.push(
        `Coverage period: ${[summary.coverageStartDate, summary.coverageEndDate].filter(Boolean).join(' – ')}`
      )
    }
  } else if (payerNameRaw && !summary.coverageDetail.payerName) {
    lines.push(`Payer: ${payerNameRaw}`)
  }

  if (summary.coverageDetail) {
    lines.push(formatCoverageDetailNoteSection(summary.coverageDetail))
  } else if (summary.rheum) {
    lines.push(formatRheumPacketNoteSection(summary.rheum))
  }

  if (!summary.coverageDetail && summary.benefits.length > 0) {
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

function formatCoverageDetailNoteSection(detail: EligibilityCoverageDetail): string {
  const lines: string[] = ['', 'Benefit verification']
  const add = (label: string, value?: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  add('Payer', detail.payerName)
  add('Payer ID', detail.payerId)
  add('Plan', detail.planName)
  add('Plan type', detail.insuranceType || detail.planType)
  add('Group', detail.groupNumber)
  add('Plan #', detail.planNumber)
  add('Coverage level', detail.coverageLevel)
  add('Member status', detail.memberStatus)
  add('Plan description', detail.planDescription)
  add('Coverage start', detail.coverageStartDate)
  add('Coverage end', detail.coverageEndDate)
  add('As of', detail.serviceDate)
  add('Reference #', detail.referenceNumber)

  const money = (pair?: { total?: string; remaining?: string }) => {
    if (!pair?.total && !pair?.remaining) return undefined
    if (pair.total && pair.remaining) return `${pair.total} total / ${pair.remaining} remaining`
    return pair.total || pair.remaining
  }
  add('INN deductible', money(detail.inn?.deductible))
  add('OON deductible', money(detail.oon?.deductible))
  add('INN out-of-pocket', money(detail.inn?.oop))
  add('OON out-of-pocket', money(detail.oon?.oop))
  add('INN office copay', detail.inn?.officeCopay)
  add('OON office copay', detail.oon?.officeCopay)
  add('INN office coinsurance', detail.inn?.officeCoinsurance)
  add('OON office coinsurance', detail.oon?.officeCoinsurance)

  if (detail.copays?.length) {
    lines.push('Copays:')
    for (const row of detail.copays) {
      lines.push(`- ${row.network} ${row.services}: ${row.amount}`)
    }
  }
  if (detail.coinsuranceLines?.length) {
    lines.push('Coinsurance:')
    for (const row of detail.coinsuranceLines) {
      lines.push(`- ${row.network} ${row.services}: ${row.amount}`)
    }
  }
  if (detail.coveredServices?.length) {
    lines.push(`Covered services: ${detail.coveredServices.join(', ')}`)
  }
  if (detail.subscriber) {
    const name = [detail.subscriber.firstName, detail.subscriber.lastName].filter(Boolean).join(' ')
    add('Subscriber', name)
    add('Subscriber member ID', detail.subscriber.memberId)
    add('Subscriber DOB', detail.subscriber.dateOfBirth)
    add('Subscriber gender', detail.subscriber.gender)
    add('Subscriber address', detail.subscriber.address)
  }
  if (detail.payerCorrespondence) {
    add('Payer correspondence', detail.payerCorrespondence.name)
    add('Payer correspondence address', detail.payerCorrespondence.address)
  }
  return lines.join('\n')
}
