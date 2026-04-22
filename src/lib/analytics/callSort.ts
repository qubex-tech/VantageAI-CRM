/**
 * Client/server-safe sorting for analytics voice call rows (Prisma JSON + columns).
 */

import type { InboundClassificationInput } from '@/lib/analytics/voiceConversationInbound'

export type AnalyticsCallRow = InboundClassificationInput & {
  startedAt: string | Date
  endedAt: string | Date | null
  callerPhone: string
  extractedIntent: string | null
}

const RETELL_CUSTOM_PREFIX = 'retell_custom_data:'

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function getByPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function coerceSortable(raw: unknown): string | number | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'boolean') return raw ? 1 : 0
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const asNum = Number(trimmed)
    if (trimmed !== '' && Number.isFinite(asNum) && String(asNum) === trimmed) {
      return asNum
    }
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed) && trimmed.includes('-')) {
      return parsed
    }
    return trimmed.toLowerCase()
  }
  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw)
    } catch {
      return String(raw)
    }
  }
  return String(raw).toLowerCase()
}

/** Top-level ExtractedCallData keys merged into VoiceConversation.metadata */
export const EXTRACTED_FIELD_SORT_KEYS = [
  'call_summary',
  'call_successful',
  'user_age',
  'user_phone_number',
  'patient_phone_number',
  'patient_email',
  'detailed_call_summary',
  'patient_name',
  'patient_dob',
  'patient_type',
  'selected_time',
  'selected_date',
  'preferred_dentist',
  'call_reason',
  'new_patient_add',
  'existing_patient_update',
] as const

export const INSURANCE_VERIFICATION_SORT_KEYS = [
  'insurance_verification.provider_name',
  'insurance_verification.npi',
  'insurance_verification.tax_id',
  'insurance_verification.member_id',
  'insurance_verification.patient_first_name',
  'insurance_verification.patient_last_name',
  'insurance_verification.patient_dob',
  'insurance_verification.coverage_effective_date',
  'insurance_verification.policy_active',
  'insurance_verification.specialist_office_visit_benefits',
  'insurance_verification.telehealth_benefits',
  'insurance_verification.referral_required',
  'insurance_verification.cob_primary_plan',
  'insurance_verification.cob_secondary_plan',
  'insurance_verification.insurance_agent_name',
  'insurance_verification.reference_number',
] as const

export const COLUMN_SORT_KEYS = [
  'startedAt',
  'endedAt',
  'durationSeconds',
  'callerPhone',
  'outcome',
  'extractedIntent',
] as const

export type ColumnSortKey = (typeof COLUMN_SORT_KEYS)[number]
export type InsuranceSortKey = (typeof INSURANCE_VERIFICATION_SORT_KEYS)[number]
export type ExtractedSortKey = (typeof EXTRACTED_FIELD_SORT_KEYS)[number]

export function isRetellCustomSortKey(key: string): boolean {
  return key.startsWith(RETELL_CUSTOM_PREFIX)
}

export function makeRetellCustomSortKey(field: string): string {
  return `${RETELL_CUSTOM_PREFIX}${field}`
}

export function parseRetellCustomSortKey(key: string): string | null {
  if (!isRetellCustomSortKey(key)) return null
  return key.slice(RETELL_CUSTOM_PREFIX.length) || null
}

/** Best-effort caller / patient name from Retell-extracted metadata. */
export function getCallerDisplayName(row: AnalyticsCallRow): string {
  const meta = metadataRecord(row.metadata)
  const pn = meta.patient_name
  if (typeof pn === 'string' && pn.trim()) return pn.trim()
  const custom = meta.retell_custom_data
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    const c = custom as Record<string, unknown>
    const caller = c['Caller Name'] ?? c['caller name']
    if (caller != null && String(caller).trim()) return String(caller).trim()
    const first = c['Patient First Name'] ?? c['patient first name']
    const last = c['Patient Last Name'] ?? c['patient last name']
    const combined = `${first != null ? String(first) : ''} ${last != null ? String(last) : ''}`.trim()
    if (combined) return combined
  }
  return '—'
}

export function collectRetellCustomDataKeysFromRows(rows: AnalyticsCallRow[]): string[] {
  const keys = new Set<string>()
  for (const row of rows) {
    const meta = metadataRecord(row.metadata)
    const custom = meta.retell_custom_data
    if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
      for (const k of Object.keys(custom as Record<string, unknown>)) {
        if (k) keys.add(k)
      }
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b))
}

export function getCallSortValue(row: AnalyticsCallRow, sortKey: string): string | number | null {
  if (sortKey === 'startedAt') {
    const d = toDate(row.startedAt)
    return d ? d.getTime() : null
  }
  if (sortKey === 'endedAt') {
    const d = toDate(row.endedAt)
    return d ? d.getTime() : null
  }
  if (sortKey === 'durationSeconds') {
    const start = toDate(row.startedAt)
    const end = toDate(row.endedAt)
    if (!start || !end) return null
    return Math.max(0, (end.getTime() - start.getTime()) / 1000)
  }
  if (sortKey === 'callerPhone') {
    return row.callerPhone ? String(row.callerPhone).toLowerCase() : null
  }
  if (sortKey === 'outcome') {
    return row.outcome ? String(row.outcome).toLowerCase() : null
  }
  if (sortKey === 'extractedIntent') {
    return row.extractedIntent ? String(row.extractedIntent).toLowerCase() : null
  }

  const customField = parseRetellCustomSortKey(sortKey)
  if (customField) {
    const meta = metadataRecord(row.metadata)
    const custom = meta.retell_custom_data
    if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
      return coerceSortable((custom as Record<string, unknown>)[customField])
    }
    return null
  }

  if ((INSURANCE_VERIFICATION_SORT_KEYS as readonly string[]).includes(sortKey)) {
    const parts = sortKey.split('.')
    const meta = metadataRecord(row.metadata)
    return coerceSortable(getByPath(meta, parts))
  }

  if ((EXTRACTED_FIELD_SORT_KEYS as readonly string[]).includes(sortKey)) {
    const meta = metadataRecord(row.metadata)
    return coerceSortable(meta[sortKey])
  }

  return null
}

function compareNullable(a: string | number | null, b: string | number | null): number {
  const rank = (v: string | number | null) => (v === null ? 1 : 0)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  if (rank(a) === 1) return 0
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortCalls<T extends AnalyticsCallRow>(
  rows: T[],
  sortKey: string,
  order: 'asc' | 'desc'
): T[] {
  const dir = order === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = getCallSortValue(a, sortKey)
    const vb = getCallSortValue(b, sortKey)
    return compareNullable(va, vb) * dir
  })
}

export function formatCallSortValueForDisplay(row: AnalyticsCallRow, sortKey: string): string {
  const v = getCallSortValue(row, sortKey)
  if (v === null) return '—'
  if (sortKey === 'startedAt' || sortKey === 'endedAt') {
    const d = toDate(sortKey === 'startedAt' ? row.startedAt : row.endedAt)
    return d ? d.toLocaleString() : '—'
  }
  if (sortKey === 'durationSeconds' && typeof v === 'number') {
    const m = Math.round(v / 60)
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
  }
  return String(v)
}
