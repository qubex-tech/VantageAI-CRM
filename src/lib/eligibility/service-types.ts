export type ServiceTypeGroup = 'general' | 'medical' | 'dental'

export interface EligibilityServiceType {
  code: string
  label: string
  group: ServiceTypeGroup
}

/** X12 005010 STCs commonly used for eligibility (Stedi / CAQH CORE). */
export const ELIGIBILITY_SERVICE_TYPES: EligibilityServiceType[] = [
  { code: '30', label: 'Health Benefit Plan Coverage', group: 'general' },
  { code: '35', label: 'Dental Care', group: 'general' },

  { code: '1', label: 'Medical Care', group: 'medical' },
  { code: '98', label: 'Professional (Physician) Visit — Office', group: 'medical' },
  { code: '96', label: 'Professional (Physician) Visit — Outpatient', group: 'medical' },
  { code: '3', label: 'Consultation', group: 'medical' },
  { code: '9', label: 'Telehealth', group: 'medical' },
  { code: '33', label: 'Chiropractic', group: 'medical' },
  { code: '47', label: 'Hospital', group: 'medical' },
  { code: '48', label: 'Hospital — Inpatient', group: 'medical' },
  { code: '50', label: 'Hospital — Outpatient', group: 'medical' },
  { code: '86', label: 'Emergency Services', group: 'medical' },
  { code: '88', label: 'Pharmacy', group: 'medical' },
  { code: 'UC', label: 'Urgent Care', group: 'medical' },
  { code: 'MH', label: 'Mental Health', group: 'medical' },
  { code: 'AL', label: 'Vision — Optometry', group: 'medical' },
  { code: 'PT', label: 'Physical Therapy', group: 'medical' },
  { code: 'AD', label: 'Occupational Therapy', group: 'medical' },
  { code: 'AE', label: 'Physical Therapy (CORE)', group: 'medical' },
  { code: 'AF', label: 'Speech Therapy', group: 'medical' },
  { code: 'AG', label: 'Skilled Nursing Care', group: 'medical' },
  { code: 'AI', label: 'Substance Abuse', group: 'medical' },
  { code: 'A4', label: 'Psychiatric', group: 'medical' },
  { code: 'DM', label: 'Durable Medical Equipment', group: 'medical' },
  { code: '78', label: 'Chemotherapy', group: 'medical' },
  { code: '93', label: 'Podiatry', group: 'medical' },
  { code: '69', label: 'Maternity', group: 'medical' },

  { code: '23', label: 'Diagnostic Dental', group: 'dental' },
  { code: '41', label: 'Preventive Dental', group: 'dental' },
  { code: '25', label: 'Restorative Dental', group: 'dental' },
  { code: '26', label: 'Endodontics', group: 'dental' },
  { code: '24', label: 'Periodontics', group: 'dental' },
  { code: '27', label: 'Maxillofacial Prosthetics', group: 'dental' },
  { code: '39', label: 'Prosthodontics', group: 'dental' },
  { code: '40', label: 'Oral & Maxillofacial Surgery', group: 'dental' },
  { code: '28', label: 'Adjunctive Dental Services', group: 'dental' },
  { code: '36', label: 'Dental Crowns', group: 'dental' },
  { code: '37', label: 'Dental Accident', group: 'dental' },
  { code: '38', label: 'Orthodontics', group: 'dental' },
]

export const SERVICE_TYPE_GROUP_LABELS: Record<ServiceTypeGroup, string> = {
  general: 'General',
  medical: 'Medical',
  dental: 'Dental',
}

export const SERVICE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ELIGIBILITY_SERVICE_TYPES.map((item) => [item.code, item.label])
)

const ALLOWED_CODES = new Set(
  ELIGIBILITY_SERVICE_TYPES.map((item) => item.code.toUpperCase())
)

export function normalizeServiceTypeCodes(
  value: unknown,
  fallback = '30'
): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : []
  const codes: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    const code = String(entry || '').trim()
    if (!code) continue
    const key = code.toUpperCase()
    if (seen.has(key)) continue
    if (ALLOWED_CODES.size && !ALLOWED_CODES.has(key) && !/^[0-9A-Z]{1,3}$/.test(key)) {
      continue
    }
    seen.add(key)
    const catalog = ELIGIBILITY_SERVICE_TYPES.find((item) => item.code.toUpperCase() === key)
    codes.push(catalog?.code || code)
  }
  if (!codes.length) return [fallback]
  const order = new Map(
    ELIGIBILITY_SERVICE_TYPES.map((item, index) => [item.code.toUpperCase(), index])
  )
  return [...codes].sort((a, b) => (order.get(a.toUpperCase()) ?? 999) - (order.get(b.toUpperCase()) ?? 999))
}

export function primaryServiceTypeCode(codes: string[], fallback = '30'): string {
  return orderServiceTypeCodesForRequest(codes)[0] || fallback
}

/**
 * Send one general STC on the 270. Asking Aetna (and similar dental payers) for
 * every sibling code (23/41/25/…) comes back as a stub 271 that marks those
 * services non-covered. Request 35 or 30; the 271 still includes copays,
 * coinsurance, and limitations for the sibling types.
 */
export function orderServiceTypeCodesForRequest(codes?: string[]): string[] {
  const normalized = normalizeServiceTypeCodes(codes ?? [])
  if (normalized.includes('35')) return ['35']
  if (normalized.includes('30')) return ['30']
  return normalized
}

/** Payers often return sibling STCs (23/41/…) instead of the general 30/35 we requested. */
export function expandRequestedServiceTypeCodes(codes?: string[]): string[] {
  if (!codes?.length) return []
  const requested = normalizeServiceTypeCodes(codes)
  const expanded = new Set(requested.map((code) => code.toUpperCase()))
  const includeGroup = (group: ServiceTypeGroup) => {
    for (const item of ELIGIBILITY_SERVICE_TYPES) {
      if (item.group === group) expanded.add(item.code.toUpperCase())
    }
  }
  if (expanded.has('30')) includeGroup('medical')
  if (expanded.has('35')) includeGroup('dental')
  return [...expanded]
}
