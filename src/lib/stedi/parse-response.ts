import {
  createEmptyRheumPacket,
  finalizeRheumPacket,
  type EligibilityNetworkStatus,
  type RheumEligibilityPacket,
} from '@/lib/eligibility/rheum-packet'
import type { ParsedEligibilitySummary } from '@/lib/availity/types'
import { STEDI_PAYER_DOWN_CODES } from './types'
import type { StediBenefitInformation, StediEligibilityResponse } from './types'

const OFFICE_SERVICE_CODES = new Set(['98', '96', '48', '50', '3', '47', '86', 'AL', 'AG'])

function formatStediDate(value?: string): string | undefined {
  if (!value) return undefined
  const compact = value.replace(/-/g, '')
  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  }
  return value
}

function money(value?: string): string | undefined {
  if (value == null || value === '') return undefined
  const trimmed = String(value).trim()
  if (!trimmed) return undefined
  return trimmed.includes('$') ? trimmed : `$${trimmed}`
}

function isInNetwork(benefit: StediBenefitInformation): boolean {
  const code = String(benefit.inPlanNetworkIndicatorCode || '').toUpperCase()
  const text = String(benefit.inPlanNetworkIndicator || '').toLowerCase()
  return code === 'Y' || text === 'yes' || text === 'y'
}

function isRemaining(benefit: StediBenefitInformation): boolean {
  const q = `${benefit.quantityQualifier || ''} ${benefit.quantityQualifierCode || ''}`.toLowerCase()
  return q.includes('remain')
}

function benefitScore(benefit: StediBenefitInformation): number {
  const text = `${benefit.name || ''} ${(benefit.serviceTypes || []).join(' ')}`.toLowerCase()
  const codes = benefit.serviceTypeCodes || []
  let score = 0
  if (codes.some((c) => OFFICE_SERVICE_CODES.has(String(c)))) score += 40
  if (/specialist/.test(text)) score += 50
  if (/professional|physician|office visit/.test(text)) score += 30
  if (codes.includes('30') || /health benefit plan/.test(text)) score += 10
  if (/pharmacy|rx|dental|vision/.test(text)) score -= 20
  if (isInNetwork(benefit)) score += 15
  return score
}

function inferPlanType(response: StediEligibilityResponse): string | undefined {
  const fromBenefits = (response.benefitsInformation || [])
    .map((b) => b.insuranceType)
    .find(Boolean)
  const raw = [
    fromBenefits,
    response.planStatus?.[0]?.planDetails,
    response.planInformation?.groupDescription,
  ]
    .filter(Boolean)
    .join(' ')
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (/\bppo\b|preferred provider/.test(lower)) return 'PPO'
  if (/\bhmo\b|health maintenance/.test(lower)) return 'HMO'
  if (/medicare advantage|\bma\b|part c/.test(lower)) return 'Medicare Advantage'
  if (/marketplace|exchange|aca/.test(lower)) return 'Marketplace'
  if (/medicaid/.test(lower)) return 'Medicaid'
  if (/medicare/.test(lower)) return 'Medicare'
  if (/commercial/.test(lower)) return 'Commercial'
  return fromBenefits || response.planStatus?.[0]?.planDetails
}

function inferNetwork(benefits: StediBenefitInformation[]): EligibilityNetworkStatus {
  const inn = benefits.some(isInNetwork)
  const onn = benefits.some((b) => {
    const code = String(b.inPlanNetworkIndicatorCode || '').toUpperCase()
    return code === 'N' || String(b.inPlanNetworkIndicator || '').toLowerCase() === 'no'
  })
  if (inn && !onn) return 'inn'
  if (onn && !inn) return 'onn'
  if (inn) return 'inn'
  return 'unknown'
}

function pickAmount(
  benefits: StediBenefitInformation[],
  code: string,
  opts?: { remaining?: boolean; preferOffice?: boolean }
): string | undefined {
  const matches = benefits.filter((b) => b.code === code)
  const ranked = [...matches].sort((a, b) => benefitScore(b) - benefitScore(a))
  const remainingWanted = Boolean(opts?.remaining)
  const filtered = ranked.filter((b) => isRemaining(b) === remainingWanted)
  const pool = filtered.length ? filtered : remainingWanted ? [] : ranked
  const preferred = opts?.preferOffice
    ? pool.find((b) => (b.serviceTypeCodes || []).some((c) => OFFICE_SERVICE_CODES.has(String(c)))) ||
      pool[0]
    : pool[0]
  if (!preferred) return undefined
  if (code === 'A') {
    const pct = preferred.benefitPercent
    if (pct == null || pct === '') return undefined
    const n = Number(pct)
    if (Number.isFinite(n) && n <= 1) return `${Math.round(n * 100)}%`
    return String(pct).includes('%') ? String(pct) : `${pct}%`
  }
  return money(preferred.benefitAmount)
}

function authRequired(benefits: StediBenefitInformation[]): boolean | null {
  const withFlag = benefits.find((b) => b.authOrCertIndicator)
  if (!withFlag?.authOrCertIndicator) return null
  const v = String(withFlag.authOrCertIndicator).toUpperCase()
  if (v === 'Y' || v === 'YES') return true
  if (v === 'N' || v === 'NO') return false
  return null
}

export function isStediPayerDown(response: StediEligibilityResponse): boolean {
  return (response.errors || []).some((err) => STEDI_PAYER_DOWN_CODES.has(String(err.code || '')))
}

export function buildRheumPacketFromStediResponse(
  response: StediEligibilityResponse
): RheumEligibilityPacket {
  const benefits = response.benefitsInformation || []
  const packet = createEmptyRheumPacket('office_visit', 'stedi_api')
  packet.planType = inferPlanType(response)
  packet.memberStatus = response.planStatus?.[0]?.status
  packet.networkStatus = inferNetwork(benefits)

  const copay = pickAmount(benefits, 'B', { preferOffice: true })
  const deductible = pickAmount(benefits, 'C')
  const deductibleRemaining = pickAmount(benefits, 'C', { remaining: true })
  const coins = pickAmount(benefits, 'A', { preferOffice: true })
  const oop = pickAmount(benefits, 'G')
  const oopRemaining = pickAmount(benefits, 'G', { remaining: true })

  if (copay) packet.specialistCopay = copay
  if (deductible || deductibleRemaining) {
    packet.deductible = { total: deductible, remaining: deductibleRemaining }
  }
  if (coins) packet.coinsurance = coins
  if (oop || oopRemaining) {
    packet.oop = { max: oop, remaining: oopRemaining }
  }
  packet.authRequired = authRequired(benefits)
  packet.verifiedBy = 'Stedi'
  return finalizeRheumPacket(packet)
}

export function parseStediEligibilityResponse(
  response: StediEligibilityResponse
): ParsedEligibilitySummary {
  const errors = (response.errors || [])
    .map((e) => e.description || e.field || e.code || '')
    .filter(Boolean)

  const plan = response.planStatus?.[0]
  const statusCode = String(plan?.statusCode || '')
  const statusText = String(plan?.status || '').toLowerCase()

  let eligibilityStatus: ParsedEligibilitySummary['eligibilityStatus'] = 'unknown'
  if (errors.length > 0 && !isStediPayerDown(response)) {
    eligibilityStatus = 'error'
  } else if (statusCode === '1' || statusText.includes('active')) {
    eligibilityStatus = 'active'
  } else if (
    ['6', '2', '3', '4', '5'].includes(statusCode) ||
    statusText.includes('inactive') ||
    statusText.includes('terminated')
  ) {
    eligibilityStatus = 'inactive'
  } else if ((response.benefitsInformation || []).some((b) => b.code === '1')) {
    eligibilityStatus = 'active'
  }

  const rheum =
    eligibilityStatus === 'error' ? undefined : buildRheumPacketFromStediResponse(response)

  return {
    eligibilityStatus,
    planStatus: plan?.status,
    payerName: response.payer?.name || response.payer?.entityName,
    payerId:
      response.payer?.payorIdentification ||
      response.payer?.entityIdentificationValue ||
      response.tradingPartnerServiceId,
    groupNumber:
      response.planInformation?.groupNumber || response.subscriber?.groupNumber,
    planName: plan?.planDetails || response.planInformation?.groupDescription,
    planType: rheum?.planType,
    coverageStartDate: formatStediDate(response.planDateInformation?.planBegin),
    coverageEndDate: formatStediDate(response.planDateInformation?.planEnd),
    eligibilityStartDate: formatStediDate(response.planDateInformation?.eligibilityBegin),
    eligibilityEndDate: formatStediDate(response.planDateInformation?.eligibilityEnd),
    benefits: (response.benefitsInformation || []).slice(0, 12).map((b) => ({
      name: b.name || b.code || 'Benefit',
      status: b.inPlanNetworkIndicator,
      detail: [b.benefitAmount, b.benefitPercent, (b.serviceTypeCodes || []).join(',')]
        .filter(Boolean)
        .join(' '),
    })),
    validationMessages: errors,
    rawPlanCount: response.planStatus?.length || 0,
    rheum,
  }
}
