import { buildRheumPacketFromAvailityPlans } from '@/lib/eligibility/parse-availity-amounts'
import { formatRheumPacketNoteSection } from '@/lib/eligibility/rheum-packet'
import { formatUserFacingDateTime } from '@/lib/timezone'
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

function titleCaseToken(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatNoteDate(
  value: string | number | Date | null | undefined,
  timeZone?: string
): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  const formatted = formatUserFacingDateTime(value, {
    timeZone,
    dateStyle: 'medium',
    dateOnly: true,
  })
  return formatted === 'Invalid date' ? String(value) : formatted
}

function noteLine(label: string, value?: string | null): string | undefined {
  const text = value?.toString().trim()
  if (!text) return undefined
  return `${label}: ${text}`
}

function appendSection(lines: string[], title: string, rows: Array<string | undefined>) {
  const body = rows.filter((row): row is string => Boolean(row && row.trim()))
  if (body.length === 0) return
  if (lines.length > 0) lines.push('')
  lines.push(title)
  lines.push(...body)
}

export function formatEligibilityNoteContent(params: {
  summary: ParsedEligibilitySummary
  payerNameRaw?: string
  checkedAt?: Date
  sourceLabel?: string | null
  timeZone?: string
  patientName?: string
  patientDob?: string | Date | null
  memberId?: string
  groupNumber?: string
  planName?: string
  planType?: string
  isPrimary?: boolean
}): string {
  const { summary, payerNameRaw, checkedAt, sourceLabel = 'Availity', timeZone } = params
  const lines: string[] = [
    sourceLabel ? `Eligibility / Billing Note (${sourceLabel})` : 'Eligibility / Billing Note',
  ]

  if (checkedAt) {
    lines.push(
      `Checked: ${formatUserFacingDateTime(checkedAt, {
        timeZone,
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`
    )
  }
  lines.push(`Status: ${titleCaseToken(summary.eligibilityStatus)}`)
  if (summary.planStatus) lines.push(`Plan status: ${summary.planStatus}`)

  appendSection(lines, 'Patient & policy', [
    noteLine('Patient', params.patientName),
    noteLine('Date of birth', formatNoteDate(params.patientDob, timeZone)),
    noteLine('Policy', params.isPrimary == null ? undefined : params.isPrimary ? 'Primary' : 'Secondary'),
    noteLine('Member ID', params.memberId),
    noteLine('Group #', params.groupNumber || summary.groupNumber),
  ])

  const coverage = summary.coverageDetail
  if (!coverage) {
    appendSection(lines, 'Plan', [
      noteLine('Payer', summary.payerName || payerNameRaw),
      noteLine('Payer ID', summary.payerId),
      noteLine('Plan', summary.planName || params.planName),
      noteLine('Plan type', summary.planType || params.planType),
      noteLine('Group #', summary.groupNumber && summary.groupNumber !== params.groupNumber ? summary.groupNumber : undefined),
      noteLine(
        'Coverage period',
        [formatNoteDate(summary.coverageStartDate, timeZone), formatNoteDate(summary.coverageEndDate, timeZone)]
          .filter(Boolean)
          .join(' – ') || undefined
      ),
      noteLine(
        'Eligibility period',
        [formatNoteDate(summary.eligibilityStartDate, timeZone), formatNoteDate(summary.eligibilityEndDate, timeZone)]
          .filter(Boolean)
          .join(' – ') || undefined
      ),
    ])
  } else if (payerNameRaw && !coverage.payerName) {
    appendSection(lines, 'Plan', [noteLine('Payer', payerNameRaw)])
  }

  if (coverage) {
    const coverageLines = formatCoverageDetailNoteSection(coverage, timeZone)
    if (coverageLines) {
      if (lines.length > 0) lines.push('')
      lines.push(coverageLines)
    }
  }
  if (summary.rheum) {
    const rheumLines = formatRheumPacketNoteSection(summary.rheum)
    if (rheumLines) {
      if (lines.length > 0) lines.push('')
      lines.push(rheumLines.trimStart())
    }
  }

  if (!coverage && summary.benefits.length > 0) {
    appendSection(
      lines,
      'Benefits',
      summary.benefits.slice(0, 12).map((benefit) =>
        `- ${benefit.name}${benefit.status ? `: ${benefit.status}` : ''}${
          benefit.detail && benefit.detail !== benefit.status ? ` (${benefit.detail})` : ''
        }`
      )
    )
  }

  if (summary.validationMessages.length > 0) {
    appendSection(
      lines,
      'Payer messages',
      summary.validationMessages.map((msg) => `- ${msg}`)
    )
  }

  return lines.join('\n')
}

function formatCoverageDetailNoteSection(
  detail: EligibilityCoverageDetail,
  timeZone?: string
): string {
  const lines: string[] = []
  const money = (pair?: { total?: string; remaining?: string }) => {
    if (!pair?.total && !pair?.remaining) return undefined
    if (pair.total && pair.remaining) return `${pair.total} total / ${pair.remaining} remaining`
    return pair.total || pair.remaining
  }

  appendSection(lines, 'Plan', [
    noteLine('Payer', detail.payerName),
    noteLine('Payer ID', detail.payerId),
    noteLine('Plan', detail.planName),
    noteLine('Plan type', detail.insuranceType || detail.planType),
    noteLine('Plan description', detail.planDescription),
    noteLine('Employer', detail.employer && detail.employer !== detail.planDescription ? detail.employer : undefined),
    noteLine('Group #', detail.groupNumber),
    noteLine('Plan #', detail.planNumber),
    noteLine('ID card #', detail.idCardSerialNumber),
    noteLine('Coverage level', detail.coverageLevel),
    noteLine('Member status', detail.memberStatus),
    noteLine('Coverage start', formatNoteDate(detail.coverageStartDate, timeZone)),
    noteLine('Coverage end', formatNoteDate(detail.coverageEndDate, timeZone)),
    noteLine('Eligibility start', formatNoteDate(detail.eligibilityStartDate, timeZone)),
    noteLine('Eligibility end', formatNoteDate(detail.eligibilityEndDate, timeZone)),
    noteLine('As of', formatNoteDate(detail.serviceDate, timeZone)),
    noteLine('Last visit', formatNoteDate(detail.latestVisitDate, timeZone)),
    noteLine('Reference #', detail.referenceNumber),
  ])

  appendSection(lines, 'Financials', [
    noteLine('Annual maximum', money(detail.annualMaximum)),
    noteLine('INN deductible', money(detail.inn?.deductible)),
    noteLine('OON deductible', money(detail.oon?.deductible)),
    noteLine('INN out-of-pocket', money(detail.inn?.oop)),
    noteLine('OON out-of-pocket', money(detail.oon?.oop)),
    noteLine('INN office copay', detail.inn?.officeCopay),
    noteLine('OON office copay', detail.oon?.officeCopay),
    noteLine('INN office coinsurance', detail.inn?.officeCoinsurance),
    noteLine('OON office coinsurance', detail.oon?.officeCoinsurance),
  ])

  if (detail.copays?.length) {
    appendSection(
      lines,
      'Copays',
      detail.copays.map((row) => `- ${row.network} ${row.services}: ${row.amount}`)
    )
  }
  if (detail.coinsuranceLines?.length) {
    appendSection(
      lines,
      'Coinsurance',
      detail.coinsuranceLines.map((row) => `- ${row.network} ${row.services}: ${row.amount}`)
    )
  }
  if (detail.benefitLines?.length) {
    appendSection(
      lines,
      'All benefits',
      detail.benefitLines.map((row) => {
        const bits = [
          row.category,
          row.services,
          row.amount,
          row.network && row.network !== 'N/A' ? row.network : undefined,
          row.coverageLevel,
          row.period,
          row.notes,
        ].filter(Boolean)
        return `- ${bits.join(' · ')}`
      })
    )
  }
  if (detail.coveredServices?.length) {
    appendSection(lines, 'Covered services', [detail.coveredServices.join(', ')])
  }

  if (detail.subscriber) {
    const name = [detail.subscriber.firstName, detail.subscriber.lastName].filter(Boolean).join(' ')
    appendSection(lines, 'Subscriber', [
      noteLine('Name', name),
      noteLine('Member ID', detail.subscriber.memberId),
      noteLine('Date of birth', formatNoteDate(detail.subscriber.dateOfBirth, timeZone)),
      noteLine('Gender', detail.subscriber.gender),
      noteLine('Address', detail.subscriber.address),
    ])
  }

  if (detail.dependents?.length) {
    appendSection(
      lines,
      'Dependents',
      detail.dependents.map((dependent) => {
        const name = [dependent.firstName, dependent.lastName].filter(Boolean).join(' ')
        const bits = [
          name,
          dependent.relationship,
          dependent.dateOfBirth ? formatNoteDate(dependent.dateOfBirth, timeZone) : undefined,
          dependent.gender,
        ].filter(Boolean)
        return `- ${bits.join(' · ')}`
      })
    )
  }

  if (detail.payerCorrespondence?.name || detail.payerCorrespondence?.address) {
    appendSection(lines, 'Payer correspondence', [
      noteLine('Name', detail.payerCorrespondence.name),
      noteLine('Address', detail.payerCorrespondence.address),
    ])
  }

  return lines.join('\n')
}
