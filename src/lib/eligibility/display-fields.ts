import type { ParsedEligibilitySummary } from '@/lib/availity/types'
import type { RheumEligibilityPacket } from './rheum-packet'

export const ELIGIBILITY_DISPLAY_FIELD_IDS = [
  'plan_status',
  'network',
  'plan_type',
  'referral_required',
  'copay',
  'deductible',
  'coinsurance',
  'oop',
] as const

export type EligibilityDisplayFieldId = (typeof ELIGIBILITY_DISPLAY_FIELD_IDS)[number]

export const UNKNOWN_DISPLAY_VALUE = 'Unknown'

export interface EligibilityDisplayFieldOption {
  id: EligibilityDisplayFieldId
  label: string
  description: string
}

export const ELIGIBILITY_DISPLAY_CATALOG: EligibilityDisplayFieldOption[] = [
  {
    id: 'plan_status',
    label: 'Plan status',
    description: 'Whether coverage is active or terminated',
  },
  {
    id: 'network',
    label: 'Network',
    description: 'Participating (in-network) or not participating',
  },
  {
    id: 'plan_type',
    label: 'Plan type',
    description: 'HMO, PPO, Medicare Advantage, and similar labels from the payer',
  },
  {
    id: 'referral_required',
    label: 'Referral required',
    description:
      'Whether the plan requires a referral. If that is not a yes/no, we show the payer’s authorization note.',
  },
  {
    id: 'copay',
    label: 'Specialist copay',
    description: 'Office-visit copay for a specialist',
  },
  {
    id: 'deductible',
    label: 'Deductible',
    description: 'Met when remaining is $0; otherwise the amount still owed',
  },
  {
    id: 'coinsurance',
    label: 'Coinsurance',
    description: 'Plan/patient split, shown as 80/20',
  },
  {
    id: 'oop',
    label: 'Out-of-pocket remaining',
    description: 'Amount left before the out-of-pocket maximum is met',
  },
]

export interface EligibilityDisplayFieldToggle {
  id: EligibilityDisplayFieldId
  crm: boolean
  ehr: boolean
}

export interface EligibilityDisplayFieldsConfig {
  fields: EligibilityDisplayFieldToggle[]
}

export interface EligibilityDisplaySnapshotField {
  id: EligibilityDisplayFieldId
  label: string
  value: string
  /** CRM-only copy when it should keep Yes/No/Unknown plus a payer note. */
  crmValue?: string
  crm: boolean
  ehr: boolean
}

export interface EligibilityDisplaySnapshot {
  fields: EligibilityDisplaySnapshotField[]
}

export const LONESTAR_DEFAULT_DISPLAY_FIELDS: EligibilityDisplayFieldsConfig = {
  fields: ELIGIBILITY_DISPLAY_FIELD_IDS.map((id) => ({ id, crm: true, ehr: true })),
}

const CATALOG_BY_ID = new Map(ELIGIBILITY_DISPLAY_CATALOG.map((field) => [field.id, field]))
const FIELD_ID_SET = new Set<string>(ELIGIBILITY_DISPLAY_FIELD_IDS)

export function isLonestarPracticeName(name?: string | null): boolean {
  return /lonestar/i.test(name || '')
}

export function parseDisplayFieldsConfig(raw: unknown): EligibilityDisplayFieldsConfig | null {
  if (raw == null) return null
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { fields?: unknown }).fields)
      ? (raw as { fields: unknown[] }).fields
      : null
  if (!rows) return null

  const byId = new Map<EligibilityDisplayFieldId, EligibilityDisplayFieldToggle>()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = (row as { id?: unknown }).id
    if (typeof id !== 'string' || !FIELD_ID_SET.has(id)) continue
    const fieldId = id as EligibilityDisplayFieldId
    byId.set(fieldId, {
      id: fieldId,
      crm: Boolean((row as { crm?: unknown }).crm),
      ehr: Boolean((row as { ehr?: unknown }).ehr),
    })
  }

  return {
    fields: ELIGIBILITY_DISPLAY_FIELD_IDS.map(
      (id) => byId.get(id) || { id, crm: false, ehr: false }
    ),
  }
}

export function isZeroMoney(value?: string | null): boolean {
  const amount = parseMoneyNumber(value)
  return amount === 0
}

export function formatCoinsuranceSplit(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined
  const trimmed = raw.trim()
  const alreadySplit = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (alreadySplit) return `${alreadySplit[1]}/${alreadySplit[2]}`

  let patientPct: number | null = null
  const percent = trimmed.match(/(\d+(?:\.\d+)?)\s*%/)
  if (percent) {
    patientPct = Number(percent[1])
  } else {
    const n = Number(trimmed)
    if (Number.isFinite(n)) patientPct = n <= 1 ? n * 100 : n
  }
  if (patientPct == null || !Number.isFinite(patientPct)) return undefined

  const patient = Math.round(patientPct)
  const plan = Math.round(100 - patient)
  if (patient < 0 || plan < 0 || patient > 100) return undefined
  return `${plan}/${patient}`
}

export function formatDeductibleDisplay(packet?: RheumEligibilityPacket | null): string | undefined {
  const remainingRaw = packet?.deductible?.remaining
  if (remainingRaw == null || remainingRaw === '') return undefined
  if (isZeroMoney(remainingRaw)) return 'Met'
  return `Still owed ${remainingRaw}`
}

export function formatOopDisplay(packet?: RheumEligibilityPacket | null): string | undefined {
  const remainingRaw = packet?.oop?.remaining
  if (remainingRaw == null || remainingRaw === '') return undefined
  if (isZeroMoney(remainingRaw)) return 'Met'
  return `${remainingRaw} remaining`
}

export function formatPlanStatusDisplay(summary: ParsedEligibilitySummary): string | undefined {
  const raw = summary.rheum?.memberStatus || summary.planStatus
  if (raw) {
    const lower = raw.toLowerCase()
    if (lower.includes('inactive') || lower.includes('terminated')) return 'Terminated'
    if (lower.includes('active')) return 'Active'
    return raw
  }
  if (summary.eligibilityStatus === 'active') return 'Active'
  if (summary.eligibilityStatus === 'inactive') return 'Terminated'
  return undefined
}

export function formatNetworkDisplay(packet?: RheumEligibilityPacket | null): string | undefined {
  if (packet?.networkStatus === 'inn') return 'Participating'
  if (packet?.networkStatus === 'onn') return 'Not participating'
  return undefined
}

export function formatYesNo(value?: boolean | null): string | undefined {
  if (value == null) return undefined
  return value ? 'Yes' : 'No'
}

export function formatReferralDisplay(packet?: RheumEligibilityPacket | null): string | undefined {
  return formatYesNo(packet?.referralRequired) || packet?.referralNote?.trim() || undefined
}

export function formatReferralCrmDisplay(packet?: RheumEligibilityPacket | null): string {
  const status = formatYesNo(packet?.referralRequired) || UNKNOWN_DISPLAY_VALUE
  const note = packet?.referralNote?.trim()
  if (note && packet?.referralRequired == null) return `${status}\n${note}`
  return status
}

export function resolveDisplayFieldValue(
  id: EligibilityDisplayFieldId,
  summary: ParsedEligibilitySummary
): string {
  const packet = summary.rheum
  switch (id) {
    case 'plan_status':
      return formatPlanStatusDisplay(summary) || UNKNOWN_DISPLAY_VALUE
    case 'network':
      return formatNetworkDisplay(packet) || UNKNOWN_DISPLAY_VALUE
    case 'plan_type':
      return packet?.planType || summary.planType || UNKNOWN_DISPLAY_VALUE
    case 'referral_required':
      return formatReferralDisplay(packet) || UNKNOWN_DISPLAY_VALUE
    case 'copay':
      return packet?.specialistCopay || UNKNOWN_DISPLAY_VALUE
    case 'deductible':
      return formatDeductibleDisplay(packet) || UNKNOWN_DISPLAY_VALUE
    case 'coinsurance':
      return formatCoinsuranceSplit(packet?.coinsurance) || UNKNOWN_DISPLAY_VALUE
    case 'oop':
      return formatOopDisplay(packet) || UNKNOWN_DISPLAY_VALUE
  }
}

export function buildEligibilityDisplaySnapshot(
  summary: ParsedEligibilitySummary,
  config?: EligibilityDisplayFieldsConfig | null
): EligibilityDisplaySnapshot | null {
  const parsed = parseDisplayFieldsConfig(config)
  if (!parsed) return null
  const selected = parsed.fields.filter((field) => field.crm || field.ehr)
  if (selected.length === 0) return null

  return {
    fields: selected.map((field) => {
      const value = resolveDisplayFieldValue(field.id, summary)
      const crmValue =
        field.id === 'referral_required' ? formatReferralCrmDisplay(summary.rheum) : undefined
      return {
        id: field.id,
        label: CATALOG_BY_ID.get(field.id)?.label || field.id,
        value,
        ...(crmValue && crmValue !== value ? { crmValue } : {}),
        crm: field.crm,
        ehr: field.ehr,
      }
    }),
  }
}

export function withDisplaySnapshot(
  summary: ParsedEligibilitySummary,
  config?: EligibilityDisplayFieldsConfig | null
): ParsedEligibilitySummary {
  const displaySnapshot = buildEligibilityDisplaySnapshot(summary, config)
  if (!displaySnapshot) return summary
  return { ...summary, displaySnapshot }
}

export function crmDisplayFields(
  snapshot?: EligibilityDisplaySnapshot | null
): EligibilityDisplaySnapshotField[] {
  return (snapshot?.fields || []).filter((field) => field.crm)
}

export function ehrDisplayFields(
  snapshot?: EligibilityDisplaySnapshot | null
): EligibilityDisplaySnapshotField[] {
  return (snapshot?.fields || []).filter((field) => field.ehr)
}

export function formatDisplayFieldLines(
  fields: EligibilityDisplaySnapshotField[]
): string[] {
  return fields.map((field) => `${field.label}: ${field.value}`)
}

export function crmFieldDisplayValue(field: EligibilityDisplaySnapshotField): string {
  return field.crmValue || field.value
}

export function formatEligibilityActivityDescription(params: {
  eligibilityStatus: string
  checkedAtLabel: string
  snapshot?: EligibilityDisplaySnapshot | null
}): string {
  const header = `${params.eligibilityStatus} — ${params.checkedAtLabel}`
  const lines = crmDisplayFields(params.snapshot).map(
    (field) => `${field.label}: ${crmFieldDisplayValue(field)}`
  )
  return lines.length ? [header, ...lines].join('\n') : header
}

function parseMoneyNumber(value?: string | null): number | null {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
