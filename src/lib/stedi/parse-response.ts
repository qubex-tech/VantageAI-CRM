import {
  createEmptyRheumPacket,
  finalizeRheumPacket,
  type EligibilityNetworkStatus,
  type RheumEligibilityPacket,
} from '@/lib/eligibility/rheum-packet'
import { SERVICE_TYPE_LABELS, expandRequestedServiceTypeCodes } from '@/lib/eligibility/service-types'
import type { EligibilityCoverageDetail, ParsedEligibilitySummary } from '@/lib/availity/types'
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
  const q = [
    benefit.quantityQualifier,
    benefit.quantityQualifierCode,
    benefit.timeQualifier,
    benefit.timeQualifierCode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q.includes('remain') || String(benefit.timeQualifierCode || '') === '29'
}

function networkCode(benefit: StediBenefitInformation): 'Y' | 'N' | 'W' | null {
  const code = String(benefit.inPlanNetworkIndicatorCode || '').toUpperCase()
  if (code === 'Y' || code === 'N' || code === 'W') return code
  const text = String(benefit.inPlanNetworkIndicator || '').toLowerCase()
  if (text === 'yes' || text === 'y') return 'Y'
  if (text === 'no' || text === 'n') return 'N'
  if (text.includes('not applicable')) return 'W'
  return null
}

function formatPercent(value?: string): string | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  if (Number.isFinite(n) && n <= 1) return `${Math.round(n * 100)}%`
  return String(value).includes('%') ? String(value) : `${value}%`
}

function serviceLabel(benefit: StediBenefitInformation): string {
  const notes = (benefit.additionalInformation || [])
    .map((row) => row.description?.trim())
    .filter((value): value is string => Boolean(value))
  if (notes.length) return uniqueJoin(notes)
  const types = (benefit.serviceTypes || []).map((s) => s.trim()).filter(Boolean)
  if (types.length) return uniqueJoin(types)
  const fromCodes = (benefit.serviceTypeCodes || [])
    .map((code) => SERVICE_TYPE_LABELS[String(code)] || String(code))
    .filter(Boolean)
  if (fromCodes.length) return uniqueJoin(fromCodes)
  return benefit.name || 'Benefit'
}

function uniqueJoin(values: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out.join(', ')
}

function prettyCaps(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.length <= 3 && trimmed === trimmed.toUpperCase()) return trimmed
  if (trimmed !== trimmed.toUpperCase() || !/[A-Z]/.test(trimmed)) return trimmed
  return trimmed.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
}

function formatGender(value?: string): string | undefined {
  if (!value) return undefined
  const code = value.trim().toUpperCase()
  if (code === 'F' || code === 'FEMALE') return 'Female'
  if (code === 'M' || code === 'MALE') return 'Male'
  if (code === 'U' || code === 'UNK' || code === 'UNKNOWN') return 'Unknown'
  return prettyCaps(value)
}

function formatAddress(address?: {
  address1?: string
  city?: string
  state?: string
  postalCode?: string
}): string | undefined {
  if (!address) return undefined
  const line = [
    prettyCaps(address.address1),
    [prettyCaps(address.city), address.state].filter(Boolean).join(', '),
    address.postalCode,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
  return line.length ? line.join(', ') : undefined
}

function relatedEntity(benefit?: StediBenefitInformation) {
  if (!benefit) return undefined
  return benefit.benefitsRelatedEntity || benefit.benefitsRelatedEntities?.[0]
}

function payerCorrespondence(
  benefits: StediBenefitInformation[]
): EligibilityCoverageDetail['payerCorrespondence'] {
  const row = benefits.find((b) => b.code === 'W' || /other source/i.test(b.name || ''))
  const entity = relatedEntity(row)
  if (!entity) return undefined
  const name = prettyCaps(entity.entityName)
  const address = formatAddress(entity.address)
  if (!name && !address) return undefined
  return { name, address }
}

function pickNetworkAmount(
  benefits: StediBenefitInformation[],
  code: string,
  network: 'Y' | 'N',
  remaining: boolean
): string | undefined {
  const matches = benefits.filter((b) => b.code === code && networkCode(b) === network)
  const ranked = [...matches].sort((a, b) => benefitScore(b) - benefitScore(a))
  const filtered = ranked.filter((b) => isRemaining(b) === remaining)
  const preferred = filtered[0]
  if (!preferred) return undefined
  if (code === 'A') return formatPercent(preferred.benefitPercent)
  return money(preferred.benefitAmount)
}

function moneyPair(
  benefits: StediBenefitInformation[],
  code: string,
  network: 'Y' | 'N'
): { total?: string; remaining?: string } | undefined {
  const total = pickNetworkAmount(benefits, code, network, false)
  const remaining = pickNetworkAmount(benefits, code, network, true)
  if (!total && !remaining) return undefined
  return { total, remaining }
}

function groupedCosts(
  benefits: StediBenefitInformation[],
  code: 'A' | 'B'
): Array<{ services: string; amount: string; network: 'INN' | 'OON' }> {
  const rows: Array<{ services: string; amount: string; network: 'INN' | 'OON' }> = []
  const seen = new Set<string>()
  for (const benefit of benefits) {
    if (benefit.code !== code) continue
    const net = networkCode(benefit)
    if (net !== 'Y' && net !== 'N') continue
    const amount = code === 'A' ? formatPercent(benefit.benefitPercent) : money(benefit.benefitAmount)
    if (!amount) continue
    const network = net === 'Y' ? 'INN' : 'OON'
    const services = serviceLabel(benefit)
    const key = `${network}|${amount}|${services.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ services, amount, network })
  }
  return rows
}

function requestedCodeSet(codes?: string[]): Set<string> | null {
  const expanded = expandRequestedServiceTypeCodes(codes)
  if (!expanded.length) return null
  return new Set(expanded.map((code) => String(code).trim().toUpperCase()).filter(Boolean))
}

function benefitMatchesRequested(
  benefit: { serviceTypeCodes?: string[] },
  requested: Set<string> | null
): boolean {
  if (!requested) return true
  const codes = benefit.serviceTypeCodes || []
  if (!codes.length) return true
  return codes.some((code) => requested.has(String(code).trim().toUpperCase()))
}

function filterBenefits(
  benefits: StediBenefitInformation[],
  requested: Set<string> | null
): StediBenefitInformation[] {
  if (!requested) return benefits
  return benefits.filter((benefit) => benefitMatchesRequested(benefit, requested))
}

function coveredServices(
  benefits: StediBenefitInformation[],
  planStatus: StediEligibilityResponse['planStatus'],
  requested: Set<string> | null
): string[] {
  const fromStatus = (planStatus || [])
    .flatMap((row) => row.serviceTypeCodes || [])
    .filter((code) => !requested || requested.has(String(code).trim().toUpperCase()))
  const fromBenefits = filterBenefits(benefits, requested).flatMap((b) => [
    ...(b.serviceTypes || []),
    ...(b.serviceTypeCodes || []).map((code) => SERVICE_TYPE_LABELS[String(code)] || String(code)),
  ])
  const labels = [
    ...fromBenefits,
    ...fromStatus.map((code) => SERVICE_TYPE_LABELS[String(code)] || String(code)),
  ]
  return uniqueJoin(labels).split(', ').filter(Boolean)
}

export function buildCoverageDetail(
  response: StediEligibilityResponse,
  serviceTypeCodes?: string[]
): EligibilityCoverageDetail {
  const requested = requestedCodeSet(serviceTypeCodes)
  const benefits = response.benefitsInformation || []
  const scopedBenefits = filterBenefits(benefits, requested)
  const active = benefits.find((b) => b.code === '1' && b.planCoverage)
  const subscriber = response.subscriber
  const innDeductible = moneyPair(benefits, 'C', 'Y')
  const oonDeductible = moneyPair(benefits, 'C', 'N')
  const innOop = moneyPair(benefits, 'G', 'Y')
  const oonOop = moneyPair(benefits, 'G', 'N')
  const costBenefits = requested ? scopedBenefits : benefits
  const innOfficeCopay = pickAmount(costBenefits.filter((b) => networkCode(b) === 'Y'), 'B', { preferOffice: true })
  const oonOfficeCopay = pickAmount(costBenefits.filter((b) => networkCode(b) === 'N'), 'B', { preferOffice: true })
  const innOfficeCoins = pickAmount(costBenefits.filter((b) => networkCode(b) === 'Y'), 'A', { preferOffice: true })
  const oonOfficeCoins = pickAmount(costBenefits.filter((b) => networkCode(b) === 'N'), 'A', { preferOffice: true })
  const deductibleLevel = benefits.find((b) => b.code === 'C' && b.coverageLevel)?.coverageLevel

  return {
    payerName: prettyCaps(response.payer?.name || response.payer?.entityName),
    payerId:
      response.payer?.payorIdentification ||
      response.payer?.entityIdentificationValue,
    planName: response.planStatus?.[0]?.planDetails || active?.planCoverage,
    planDescription: response.planInformation?.groupDescription,
    planType: inferPlanType(response),
    insuranceType: active?.insuranceType,
    planNumber: response.planInformation?.planNumber || subscriber?.planNumber,
    groupNumber: response.planInformation?.groupNumber || subscriber?.groupNumber,
    coverageLevel: active?.coverageLevel || deductibleLevel,
    memberStatus: response.planStatus?.[0]?.status,
    coverageStartDate: formatStediDate(response.planDateInformation?.planBegin),
    coverageEndDate: formatStediDate(response.planDateInformation?.planEnd),
    eligibilityStartDate: formatStediDate(response.planDateInformation?.eligibilityBegin),
    eligibilityEndDate: formatStediDate(response.planDateInformation?.eligibilityEnd),
    serviceDate: formatStediDate(response.planDateInformation?.service),
    referenceNumber: response.controlNumber,
    coveredServices: coveredServices(benefits, response.planStatus, requested),
    subscriber: subscriber
      ? {
          firstName: prettyCaps(subscriber.firstName),
          lastName: prettyCaps(subscriber.lastName),
          memberId: subscriber.memberId,
          dateOfBirth: formatStediDate(subscriber.dateOfBirth),
          gender: formatGender(subscriber.gender),
          address: formatAddress(subscriber.address),
          groupNumber: subscriber.groupNumber,
          planNumber: subscriber.planNumber,
        }
      : undefined,
    payerCorrespondence: payerCorrespondence(benefits),
    inn: {
      deductible: innDeductible,
      oop: innOop,
      officeCopay: innOfficeCopay,
      officeCoinsurance: innOfficeCoins,
    },
    oon: {
      deductible: oonDeductible,
      oop: oonOop,
      officeCopay: oonOfficeCopay,
      officeCoinsurance: oonOfficeCoins,
    },
    copays: groupedCosts(scopedBenefits, 'B'),
    coinsuranceLines: groupedCosts(scopedBenefits, 'A'),
  }
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
    return formatPercent(preferred.benefitPercent)
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
  packet.verifiedBy = 'Eligibility check'
  return finalizeRheumPacket(packet)
}

export function parseStediEligibilityResponse(
  response: StediEligibilityResponse,
  options?: { serviceTypeCodes?: string[] }
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
    payerName: prettyCaps(response.payer?.name || response.payer?.entityName),
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
    benefits: filterBenefits(response.benefitsInformation || [], requestedCodeSet(options?.serviceTypeCodes))
      .slice(0, 12)
      .map((b) => ({
        name: b.name || b.code || 'Benefit',
        status: b.inPlanNetworkIndicator,
        detail: [b.benefitAmount, b.benefitPercent, (b.serviceTypeCodes || []).join(',')]
          .filter(Boolean)
          .join(' '),
      })),
    validationMessages: errors,
    rawPlanCount: response.planStatus?.length || 0,
    rheum,
    coverageDetail:
      eligibilityStatus === 'error'
        ? undefined
        : buildCoverageDetail(response, options?.serviceTypeCodes),
  }
}
