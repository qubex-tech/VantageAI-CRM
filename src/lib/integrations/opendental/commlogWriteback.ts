import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { getOpenDentalServices, getOpenDentalConnection } from './factory'
import { logOpenDentalAudit } from './audit'
import { OPEN_DENTAL_EXTERNAL_PREFIX } from './patientSync'
import type { ExtractedCallData } from '@/lib/process-call-data'
import type { RetellCall } from '@/lib/retell-api'

const WRITEBACK_VERSION = 'opendental_writeback_v1'

/** Open Dental commlog Mode_ for a phone call. */
const DEFAULT_MODE = 'Phone'
/** Inbound calls are received by the practice. */
const DEFAULT_SENT_OR_RECEIVED = 'Received'
/** Keep notes within a sane size for the commlog text column. */
const MAX_NOTE_LENGTH = 4000

export type CommlogWritebackResult = {
  status: 'skipped' | 'success' | 'error'
  reason?: string
  commlogNum?: number | string
}

/** Extract the Open Dental PatNum from a CRM `externalEhrId` (`opendental:{PatNum}`). */
export function extractPatNumFromExternalId(externalEhrId: string | null | undefined): number | null {
  if (!externalEhrId) return null
  if (!externalEhrId.startsWith(OPEN_DENTAL_EXTERNAL_PREFIX)) return null
  const raw = externalEhrId.slice(OPEN_DENTAL_EXTERNAL_PREFIX.length)
  // Patient external ids are `opendental:{PatNum}`; appointment ids are `opendental:apt:{AptNum}`.
  if (raw.startsWith('apt:')) return null
  const num = Number(raw)
  return Number.isInteger(num) && num > 0 ? num : null
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}\n\n[Truncated]`
}

/** Format a UTC instant as Open Dental's naive local "yyyy-MM-dd HH:mm:ss" in the clinic timezone. */
export function formatOpenDentalLocalDateTime(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

/** Compose the commlog note body from the call analysis/extracted data. */
export function buildCommlogNote(call: RetellCall, extractedData: ExtractedCallData): string {
  const lines: string[] = []
  lines.push('Vantage AI phone call')
  const summary = extractedData.call_summary || call.call_analysis?.call_summary
  const detailed = extractedData.detailed_call_summary
  if (extractedData.call_reason) lines.push(`Reason: ${extractedData.call_reason}`)
  if (summary) lines.push(`Summary: ${summary}`)
  if (detailed && detailed !== summary) lines.push(`Details: ${detailed}`)
  if (extractedData.selected_date || extractedData.selected_time) {
    lines.push(
      `Requested time: ${[extractedData.selected_date, extractedData.selected_time]
        .filter(Boolean)
        .join(' ')}`
    )
  }
  if (extractedData.preferred_dentist) lines.push(`Preferred provider: ${extractedData.preferred_dentist}`)
  const caller = extractedData.user_phone_number || extractedData.patient_phone_number
  if (caller) lines.push(`Caller: ${caller}`)
  if (call.transcript) {
    lines.push('')
    lines.push('Transcript:')
    lines.push(call.transcript)
  }
  return truncate(lines.filter(Boolean).join('\n'), MAX_NOTE_LENGTH)
}

/**
 * Low-level commlog create. Writes a single commlog for an Open Dental PatNum.
 * `commDateTime` should already be a naive clinic-local "yyyy-MM-dd HH:mm:ss" string.
 */
export async function writeOpenDentalCommlog(params: {
  practiceId: string
  patNum: number
  note: string
  commDateTime?: string
  mode?: string
  sentOrReceived?: string
  commType?: string
}): Promise<{ commlogNum?: number | string; raw: unknown }> {
  const services = await getOpenDentalServices(params.practiceId)
  const body: Record<string, unknown> = {
    PatNum: params.patNum,
    Note: params.note,
    Mode_: params.mode ?? DEFAULT_MODE,
    SentOrReceived: params.sentOrReceived ?? DEFAULT_SENT_OR_RECEIVED,
  }
  if (params.commDateTime) body.CommDateTime = params.commDateTime
  // CommType is optional — Open Dental defaults to "Miscellaneous". commType (ItemName) wins if set.
  if (params.commType) body.commType = params.commType

  const created = (await services.commlogs.create(body)) as Record<string, unknown> | null
  const commlogNum =
    (created?.CommlogNum as number | string | undefined) ?? undefined
  return { commlogNum, raw: created }
}

async function markConversationMetadata(
  conversationId: string,
  existingMetadata: Record<string, unknown>,
  updates: Record<string, unknown>
) {
  await prisma.voiceConversation.update({
    where: { id: conversationId },
    data: {
      metadata: {
        ...existingMetadata,
        ...updates,
      } as Prisma.InputJsonObject,
    },
  })
}

/**
 * Push a completed Retell call into Open Dental as a patient commlog.
 *
 * Self-gating: skips quietly when the practice has no active Open Dental connection
 * or when the linked CRM patient is not an Open Dental patient. De-duplicates via
 * the conversation's metadata so retries / re-processing do not create duplicates.
 */
export async function writeBackCallToOpenDental(params: {
  practiceId: string
  patientId: string | null
  call: RetellCall
  extractedData: ExtractedCallData
}): Promise<CommlogWritebackResult> {
  const { practiceId, patientId, call, extractedData } = params

  if (!call.call_id) return { status: 'skipped', reason: 'missing_call_id' }

  const connection = await getOpenDentalConnection(practiceId)
  if (!connection || !connection.isActive) {
    return { status: 'skipped', reason: 'opendental_not_configured' }
  }

  if (!patientId) return { status: 'skipped', reason: 'no_patient_id' }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
    select: { id: true, externalEhrId: true },
  })
  const patNum = extractPatNumFromExternalId(patient?.externalEhrId)
  if (!patNum) {
    return { status: 'skipped', reason: 'patient_not_linked_to_opendental' }
  }

  const conversation = await prisma.voiceConversation.findFirst({
    where: { practiceId, retellCallId: call.call_id },
    select: { id: true, metadata: true, startedAt: true },
  })
  const existingMetadata =
    conversation?.metadata && typeof conversation.metadata === 'object'
      ? (conversation.metadata as Record<string, unknown>)
      : {}

  if (existingMetadata.openDentalWritebackStatus === 'success') {
    return {
      status: 'skipped',
      reason: 'already_written',
      commlogNum: existingMetadata.openDentalCommlogNum as number | string | undefined,
    }
  }

  const note = buildCommlogNote(call, extractedData)
  if (!note.trim()) return { status: 'skipped', reason: 'empty_note' }

  const timeZone = await getPracticeTimeZone(practiceId)
  const startInstant = call.start_timestamp
    ? new Date(call.start_timestamp)
    : conversation?.startedAt ?? new Date()
  const commDateTime = formatOpenDentalLocalDateTime(startInstant, timeZone)

  try {
    const { commlogNum } = await writeOpenDentalCommlog({
      practiceId,
      patNum,
      note,
      commDateTime,
    })

    if (conversation) {
      await markConversationMetadata(conversation.id, existingMetadata, {
        openDentalWritebackStatus: 'success',
        openDentalCommlogNum: commlogNum ?? null,
        openDentalWritebackAt: new Date().toISOString(),
        openDentalWritebackError: null,
        openDentalWritebackVersion: WRITEBACK_VERSION,
      })
    }

    await logOpenDentalAudit({
      tenantId: practiceId,
      action: 'commlog.created',
      entity: 'Commlog',
      entityId: commlogNum != null ? String(commlogNum) : undefined,
      metadata: {
        patNum,
        patientId,
        callId: call.call_id,
        commDateTime,
        timeZone,
      },
    })

    return { status: 'success', commlogNum }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Open Dental commlog writeback failed'
    if (conversation) {
      await markConversationMetadata(conversation.id, existingMetadata, {
        openDentalWritebackStatus: 'error',
        openDentalWritebackError: message,
        openDentalWritebackFailedAt: new Date().toISOString(),
        openDentalWritebackVersion: WRITEBACK_VERSION,
      })
    }
    return { status: 'error', reason: message }
  }
}

/**
 * Write a one-off test commlog to a given PatNum to verify Commlog create permission.
 * Used by the settings "Test writeback" action.
 */
export async function writeTestCommlog(params: {
  practiceId: string
  patNum: number
  note?: string
  actorUserId?: string
}): Promise<{ commlogNum?: number | string }> {
  const timeZone = await getPracticeTimeZone(params.practiceId)
  const commDateTime = formatOpenDentalLocalDateTime(new Date(), timeZone)
  const note =
    params.note?.trim() ||
    `Vantage AI test commlog — connection verified (${new Date().toISOString()})`

  const { commlogNum } = await writeOpenDentalCommlog({
    practiceId: params.practiceId,
    patNum: params.patNum,
    note,
    commDateTime,
  })

  await logOpenDentalAudit({
    tenantId: params.practiceId,
    actorUserId: params.actorUserId,
    action: 'commlog.test_created',
    entity: 'Commlog',
    entityId: commlogNum != null ? String(commlogNum) : undefined,
    metadata: { patNum: params.patNum, commDateTime, timeZone },
  })

  return { commlogNum }
}
