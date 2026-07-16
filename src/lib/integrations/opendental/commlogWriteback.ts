import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { getOpenDentalServices, getOpenDentalConnection } from './factory'
import { logOpenDentalAudit } from './audit'
import { resolveCreatedId, unwrapCreatedRecord } from './apiResponse'
import { OPEN_DENTAL_EXTERNAL_PREFIX } from './patientSync'
import { formatPatientNoteForEhr, isPatientNoteType } from '@/lib/patient-note-types'
import { parseOpenDentalAptNumFromBookingId } from './appointmentSync'
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

/** Normalize Retell "Payment Type" to a stable label for Open Dental notes. */
export function normalizeRetellPaymentType(value: unknown): 'insurance' | 'self pay' | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return null
  if (/(self[-\s]?pay|cash|out[\s-]?of[\s-]?pocket)/i.test(raw)) return 'self pay'
  if (/insurance|insured/.test(raw)) return 'insurance'
  return null
}

/** True when Retell classified the caller as a new patient. */
export function isRetellNewPatientCall(extractedData: ExtractedCallData): boolean {
  if (extractedData.new_patient_add === true) return true
  const type = String(extractedData.patient_type ?? '').trim().toLowerCase()
  if (type === 'new patient' || type === 'new') return true
  const custom = (extractedData.retell_custom_data || {}) as Record<string, unknown>
  const customType = String(custom['Patient Type'] ?? custom['patient_type'] ?? '').trim().toLowerCase()
  return customType === 'new patient' || customType === 'new'
}

/**
 * Build the Open Dental appointment Note for a booking.
 * For new patients, appends Retell Payment Type when available (`insurance` | `self pay`).
 */
export function buildOpenDentalAppointmentNote(params: {
  reason?: string | null
  paymentType?: string | null
  isNewPatient?: boolean
}): string | null {
  const reason = params.reason?.trim() || ''
  const payment =
    params.isNewPatient === true ? normalizeRetellPaymentType(params.paymentType) : null

  if (!payment) return reason || null

  const paymentLine = `Payment type: ${payment}`
  if (/payment\s*type\s*:/i.test(reason)) return reason || paymentLine
  if (!reason) return paymentLine
  return `${reason}\n${paymentLine}`
}

function resolvePaymentTypeFromExtracted(extractedData: ExtractedCallData): 'insurance' | 'self pay' | null {
  return normalizeRetellPaymentType(
    extractedData.payment_type ??
      (extractedData.retell_custom_data as Record<string, unknown> | undefined)?.['Payment Type']
  )
}

/**
 * After a new-patient call, stamp Open Dental appointment fields that Retell only
 * finalizes at call end: IsNewPatient checkbox + Payment Type note (best-effort).
 */
async function enrichNewPatientAppointmentsFromCall(params: {
  practiceId: string
  patientId: string
  call: RetellCall
  extractedData: ExtractedCallData
  conversationStartedAt: Date | null
}): Promise<void> {
  try {
    if (!isRetellNewPatientCall(params.extractedData)) return

    const payment = resolvePaymentTypeFromExtracted(params.extractedData)
    const callStartMs = params.call.start_timestamp
      ? Number(params.call.start_timestamp)
      : params.conversationStartedAt?.getTime()
    if (!callStartMs || !Number.isFinite(callStartMs)) return

    const windowStart = new Date(callStartMs - 5 * 60_000)
    const windowEnd = new Date(
      (params.call.end_timestamp ? Number(params.call.end_timestamp) : Date.now()) + 5 * 60_000
    )

    const appointments = await prisma.appointment.findMany({
      where: {
        practiceId: params.practiceId,
        patientId: params.patientId,
        calBookingId: { startsWith: 'opendental:apt:' },
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        calBookingId: true,
        reason: true,
        notes: true,
      },
    })
    if (appointments.length === 0) return

    const services = await getOpenDentalServices(params.practiceId)
    for (const apt of appointments) {
      const nextNote = payment
        ? buildOpenDentalAppointmentNote({
            reason: apt.notes || apt.reason,
            paymentType: payment,
            isNewPatient: true,
          })
        : null
      const noteChanged = Boolean(
        nextNote && nextNote !== (apt.notes || apt.reason || '')
      )

      const aptNum = parseOpenDentalAptNumFromBookingId(apt.calBookingId)
      if (aptNum) {
        const body: Record<string, unknown> = { IsNewPatient: 'true' }
        if (noteChanged && nextNote) body.Note = nextNote
        await services.appointments.update(aptNum, body)
      }
      if (noteChanged && nextNote) {
        await prisma.appointment.update({
          where: { id: apt.id },
          data: { notes: nextNote },
        })
      }
    }
  } catch (error) {
    console.error('[OpenDental] Failed to enrich new-patient appointments from call', {
      practiceId: params.practiceId,
      patientId: params.patientId,
      callId: params.call.call_id,
      error: error instanceof Error ? error.message : error,
    })
  }
}

/** Compose the commlog note body from the call analysis/extracted data. */
export function buildCommlogNote(call: RetellCall, extractedData: ExtractedCallData): string {
  const lines: string[] = []
  lines.push('Vantage AI phone call')
  const summary = extractedData.call_summary || call.call_analysis?.call_summary
  const detailed = extractedData.detailed_call_summary
  if (extractedData.call_reason) lines.push(`Reason: ${extractedData.call_reason}`)
  if (isRetellNewPatientCall(extractedData)) {
    const payment = resolvePaymentTypeFromExtracted(extractedData)
    if (payment) lines.push(`Payment type: ${payment}`)
  }
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

  const created = await services.commlogs.create(body)
  const { record } = unwrapCreatedRecord(created)
  const commlogNum = resolveCreatedId(created, 'CommlogNum') ?? undefined
  return { commlogNum, raw: record ?? created }
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

    // For new patients, stamp IsNewPatient + Payment Type onto OD appointments
    // booked during this call (analysis is only available after the call ends).
    await enrichNewPatientAppointmentsFromCall({
      practiceId,
      patientId,
      call,
      extractedData,
      conversationStartedAt: conversation?.startedAt ?? null,
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
 * Push a CRM patient-profile note into Open Dental as a patient commlog.
 *
 * Self-gating: skips quietly when the practice has no active Open Dental connection
 * or when the patient is not an Open Dental patient. Called from the patient notes API
 * alongside the eCW/FHIR note sync.
 */
export async function syncPatientNoteToOpenDental(params: {
  practiceId: string
  patientId: string
  noteType: string
  content: string
  actorUserId?: string
}): Promise<CommlogWritebackResult> {
  const { practiceId, patientId, noteType, content, actorUserId } = params

  const connection = await getOpenDentalConnection(practiceId)
  if (!connection || !connection.isActive) {
    return { status: 'skipped', reason: 'opendental_not_configured' }
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
    select: { id: true, externalEhrId: true },
  })
  const patNum = extractPatNumFromExternalId(patient?.externalEhrId)
  if (!patNum) {
    return { status: 'skipped', reason: 'patient_not_linked_to_opendental' }
  }

  const trimmed = content.trim()
  if (!trimmed) return { status: 'skipped', reason: 'empty_note' }

  const noteBody = isPatientNoteType(noteType)
    ? formatPatientNoteForEhr(noteType, trimmed)
    : trimmed
  const note = truncate(`Vantage CRM note\n\n${noteBody}`, MAX_NOTE_LENGTH)

  const timeZone = await getPracticeTimeZone(practiceId)
  const commDateTime = formatOpenDentalLocalDateTime(new Date(), timeZone)

  try {
    const { commlogNum } = await writeOpenDentalCommlog({
      practiceId,
      patNum,
      note,
      commDateTime,
      // Manual profile notes are not phone interactions.
      mode: 'None',
      sentOrReceived: 'Neither',
    })

    await logOpenDentalAudit({
      tenantId: practiceId,
      actorUserId,
      action: 'commlog.note_synced',
      entity: 'Commlog',
      entityId: commlogNum != null ? String(commlogNum) : undefined,
      metadata: { patNum, patientId, noteType, commDateTime, timeZone },
    })

    return { status: 'success', commlogNum }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Open Dental note writeback failed'
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
