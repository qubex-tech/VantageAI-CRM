import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import { getCallerDisplayName } from '@/lib/analytics/callSort'
import { getZonedCalendarParts } from '@/lib/analytics/dashboardDateRange'
import { readTransferOutcomeFromCallRow } from '@/lib/analytics/transferMetrics'
import {
  formatPhoneNumberForDisplay,
  isUnsuccessfulTransferOutcomeText,
} from '@/lib/outbound-customer-notifications'

export type CallFeedTransferStatus = 'none' | 'successful' | 'unsuccessful'
export type CallFeedPatientType = 'New Patient' | 'Existing Patient' | 'Other'

export interface CallFeedItem {
  id: string
  retellCallId: string | null
  startedAt: string
  durationSeconds: number | null
  callerDisplayName: string
  callerPhone: string
  summary: string | null
  patientType: CallFeedPatientType
  transferStatus: CallFeedTransferStatus
  transferOutcomeRaw: string | null
}

export interface CallFeedCursor {
  startedAt: string
  id: string
}

export interface CallFeedPage {
  items: CallFeedItem[]
  nextCursor: string | null
}

export const CALL_FEED_PAGE_SIZE = 20

export type VoiceConversationFeedRow = {
  id: string
  retellCallId: string | null
  startedAt: Date | string
  endedAt: Date | string | null
  callerPhone: string
  outcome: string | null
  metadata: unknown
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
}

function toAnalyticsRow(row: VoiceConversationFeedRow): AnalyticsCallRow {
  return {
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    callerPhone: row.callerPhone,
    outcome: row.outcome,
    extractedIntent: null,
    metadata: row.metadata,
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function booleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1'].includes(normalized)) return true
    if (['false', 'no', '0'].includes(normalized)) return false
  }
  return undefined
}

/** Same New / Existing / Other rules as the staff call list. */
export function detectCallFeedPatientType(metadata: unknown): CallFeedPatientType {
  const meta = metadataRecord(metadata)
  const custom = asObject(meta.retell_custom_data)
  const patientTypeRaw =
    meta.patient_type ??
    meta.patientType ??
    custom.patient_type ??
    custom.patientType ??
    custom['Patient Type']

  const newPatientFlag = booleanLike(
    meta.new_patient_add ?? custom.new_patient_add ?? custom['New Patient Add']
  )
  const existingPatientFlag = booleanLike(
    meta.existing_patient_update ??
      custom.existing_patient_update ??
      custom['Existing Patient Update']
  )

  if (newPatientFlag === true) return 'New Patient'
  if (existingPatientFlag === true) return 'Existing Patient'

  if (typeof patientTypeRaw === 'string') {
    const lower = patientTypeRaw.toLowerCase()
    if (lower.includes('new')) return 'New Patient'
    if (lower.includes('exist') || lower.includes('return') || lower.includes('establish')) {
      return 'Existing Patient'
    }
  }

  return 'Other'
}

export function readCallFeedSummary(metadata: unknown): string | null {
  const meta = metadataRecord(metadata)
  const summary = typeof meta.call_summary === 'string' ? meta.call_summary.trim() : ''
  if (summary) return summary
  const detailed =
    typeof meta.detailed_call_summary === 'string' ? meta.detailed_call_summary.trim() : ''
  return detailed || null
}

export function resolveCallFeedTransferStatus(row: AnalyticsCallRow): {
  transferStatus: CallFeedTransferStatus
  transferOutcomeRaw: string | null
} {
  const outcome = readTransferOutcomeFromCallRow(row)
  if (!outcome) return { transferStatus: 'none', transferOutcomeRaw: null }
  if (isUnsuccessfulTransferOutcomeText(outcome)) {
    return { transferStatus: 'unsuccessful', transferOutcomeRaw: outcome }
  }
  return { transferStatus: 'successful', transferOutcomeRaw: outcome }
}

export function callFeedDurationSeconds(
  startedAt: Date | string,
  endedAt: Date | string | null
): number | null {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt)
  const end = endedAt == null ? null : endedAt instanceof Date ? endedAt : new Date(endedAt)
  if (!end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000)
  return seconds >= 0 ? seconds : null
}

export function mapVoiceConversationToFeedItem(row: VoiceConversationFeedRow): CallFeedItem {
  const analyticsRow = toAnalyticsRow(row)
  const { transferStatus, transferOutcomeRaw } = resolveCallFeedTransferStatus(analyticsRow)
  const displayName = getCallerDisplayName(analyticsRow)
  const phone = row.callerPhone?.trim() ?? ''

  return {
    id: row.id,
    retellCallId: row.retellCallId,
    startedAt: toIso(row.startedAt),
    durationSeconds: callFeedDurationSeconds(row.startedAt, row.endedAt),
    callerDisplayName: displayName !== '—' ? displayName : phone || 'Unknown caller',
    callerPhone: phone ? formatPhoneNumberForDisplay(phone) : '',
    summary: readCallFeedSummary(row.metadata),
    patientType: detectCallFeedPatientType(row.metadata),
    transferStatus,
    transferOutcomeRaw,
  }
}

export function encodeCallFeedCursor(cursor: CallFeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeCallFeedCursor(value: string): CallFeedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      typeof (parsed as CallFeedCursor).startedAt !== 'string' ||
      typeof (parsed as CallFeedCursor).id !== 'string'
    ) {
      return null
    }
    const startedAt = (parsed as CallFeedCursor).startedAt.trim()
    const id = (parsed as CallFeedCursor).id.trim()
    if (!startedAt || !id || Number.isNaN(new Date(startedAt).getTime())) return null
    return { startedAt, id }
  } catch {
    return null
  }
}

export function callFeedCursorWhere(cursor: CallFeedCursor): {
  OR: Array<{ startedAt: Date | { lt: Date }; id?: { lt: string } }>
} {
  const startedAt = new Date(cursor.startedAt)
  return {
    OR: [{ startedAt: { lt: startedAt } }, { startedAt, id: { lt: cursor.id } }],
  }
}

function calendarPartsKey(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function addCalendarDays(
  parts: { year: number; month: number; day: number },
  deltaDays: number
): { year: number; month: number; day: number } {
  const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays))
  return {
    year: anchor.getUTCFullYear(),
    month: anchor.getUTCMonth() + 1,
    day: anchor.getUTCDate(),
  }
}

export function callFeedDayKey(startedAt: string, timeZone: string): string {
  return calendarPartsKey(getZonedCalendarParts(new Date(startedAt), timeZone))
}

export function formatCallFeedDayLabel(
  startedAt: string,
  timeZone: string,
  now: Date = new Date()
): string {
  const callParts = getZonedCalendarParts(new Date(startedAt), timeZone)
  const today = getZonedCalendarParts(now, timeZone)
  const yesterday = addCalendarDays(today, -1)
  if (calendarPartsKey(callParts) === calendarPartsKey(today)) return 'Today'
  if (calendarPartsKey(callParts) === calendarPartsKey(yesterday)) return 'Yesterday'
  return new Date(startedAt).toLocaleDateString('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}
