/**
 * Shared helpers for surfacing a patient's appointments to AI voice agents.
 *
 * Used by:
 *  - the inbound Retell MCP tool `get_upcoming_appointments`
 *  - outbound slot-fill outreach (so the agent knows the patient's current visit)
 *
 * Times are formatted in each appointment's own stored IANA timezone so the
 * agent speaks the patient's local time, not server/UTC time.
 */

const DEFAULT_TIME_ZONE = 'America/New_York'

export interface VoiceAppointmentInput {
  id: string
  status: string
  startTime: Date
  endTime: Date | null
  timezone: string | null
  visitType: string | null
  reason: string | null
  providerId: string | null
  notes?: string | null
}

export interface VoiceAppointment {
  id: string
  status: string
  visit_type?: string
  reason?: string
  /** Appointment note from the chart/EHR (cleaned for the agent to speak or use). */
  notes?: string
  provider?: string
  start_time: string
  start_time_local: string
  timezone: string
  summary: string
}

/**
 * Strip CRM sync prefixes so Retell gets the real chairside note
 * (e.g. "Amir: Tooth pain") instead of "Synced from Open Dental Appointment/…".
 */
export function cleanAppointmentNoteForVoice(notes: string | null | undefined): string | undefined {
  const raw = notes?.trim()
  if (!raw) return undefined

  const stripped = raw
    .replace(/^Synced from Open Dental Appointment\/\d+\s*[—\-–]\s*/i, '')
    .trim()

  if (!stripped || /^Synced from Open Dental Appointment\/\d+$/i.test(stripped)) {
    return undefined
  }
  return stripped
}

/** True when `reason` is reschedule metadata rather than a clinical visit note. */
export function isRescheduleMetaReason(reason?: string | null): boolean {
  const r = reason?.trim().toLowerCase() || ''
  if (!r) return false
  return (
    /\breschedul/.test(r) ||
    /\bmove(d|s|ing)?\s+(my\s+)?(the\s+)?appointment\b/.test(r) ||
    /\bchang(e|ing)\s+(my\s+)?(the\s+)?appointment\b/.test(r)
  )
}

/**
 * Pick the note that should be written on a newly booked appointment during reschedule.
 * Prefer the prior appointment's chairside note when the agent only sent meta text like
 * "reschedule existing appointment".
 * Always preserves a prior `Payment type: …` line onto the chosen note.
 */
export function resolveBookingNoteFromPriorAppointment(params: {
  reason?: string | null
  priorNotes?: string | null
  priorReason?: string | null
}): string | null {
  const prior =
    cleanAppointmentNoteForVoice(params.priorNotes) ||
    params.priorReason?.trim() ||
    null
  const reason = params.reason?.trim() || ''

  let resolved: string | null
  if (!prior) resolved = reason || null
  else if (reason && reason.toLowerCase().includes(prior.toLowerCase())) resolved = reason
  else if (!reason || isRescheduleMetaReason(reason)) resolved = prior
  else resolved = reason

  // Agent often reuses only the visit reason ("checkup and cleaning") and drops the
  // Payment type line from get_upcoming notes — put it back from the prior apt.
  const priorPayment = extractPaymentTypeLine(prior) || extractPaymentTypeLine(params.priorNotes)
  if (!priorPayment) return resolved
  if (resolved && /payment\s*type\s*:/i.test(resolved)) {
    return resolved.replace(/payment\s*type\s*:[^\n\r]*/i, priorPayment).trim()
  }
  if (!resolved) return priorPayment
  return `${resolved}\n${priorPayment}`
}

function extractPaymentTypeLine(note?: string | null): string | null {
  if (!note?.trim()) return null
  const cleaned = cleanAppointmentNoteForVoice(note) || note.trim()
  const match = cleaned.match(/payment\s*type\s*:\s*([^\n\r]+)/i)
  if (!match) return null
  const raw = match[1].trim().toLowerCase()
  if (/(self[-\s]?pay|cash|out[\s-]?of[\s-]?pocket)/i.test(raw)) return 'Payment type: self pay'
  if (/insurance|insured/.test(raw)) return 'Payment type: insurance'
  return `Payment type: ${match[1].trim()}`
}

function providerLabel(providerId: string | null): string | undefined {
  if (!providerId) return undefined
  const trimmed = providerId.trim()
  if (!trimmed) return undefined
  // OD sync stores either a readable abbreviation (e.g. "DOC1") or "prov:{ProvNum}".
  const provMatch = trimmed.match(/^prov:(\d+)$/i)
  if (provMatch) return `Provider ${provMatch[1]}`
  return trimmed
}

/** Speakable local datetime for voice agents, e.g. "Monday, July 20 at 2:30 PM". */
export function formatInstantForVoiceLocal(
  instant: Date,
  timeZone: string
): { time_local: string; timezone: string } {
  const zone = timeZone?.trim() || DEFAULT_TIME_ZONE
  let dateStr: string
  let timeStr: string
  try {
    dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(instant)
    timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(instant)
  } catch {
    dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_TIME_ZONE,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(instant)
    timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(instant)
    return { time_local: `${dateStr} at ${timeStr}`, timezone: DEFAULT_TIME_ZONE }
  }
  return { time_local: `${dateStr} at ${timeStr}`, timezone: zone }
}

/**
 * Format a single appointment row into a voice-agent-friendly shape with a
 * natural-language summary the agent can read aloud verbatim.
 */
export function formatAppointmentForVoice(appt: VoiceAppointmentInput): VoiceAppointment {
  const { time_local: localWhen, timezone: timeZone } = formatInstantForVoiceLocal(
    appt.startTime,
    appt.timezone?.trim() || DEFAULT_TIME_ZONE
  )

  const visit = appt.visitType?.trim() || 'appointment'
  const provider = providerLabel(appt.providerId)
  const notes = cleanAppointmentNoteForVoice(appt.notes)
  const reason = appt.reason?.trim() || undefined
  const summaryBase = provider
    ? `${visit} with ${provider} on ${localWhen}`
    : `${visit} on ${localWhen}`
  const summary = notes ? `${summaryBase}. Note: ${notes}` : summaryBase

  return {
    id: appt.id,
    status: appt.status,
    visit_type: appt.visitType?.trim() || undefined,
    reason,
    notes,
    provider,
    start_time: appt.startTime.toISOString(),
    start_time_local: localWhen,
    timezone: timeZone,
    summary,
  }
}
