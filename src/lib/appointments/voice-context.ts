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
}

export interface VoiceAppointment {
  id: string
  status: string
  visit_type?: string
  reason?: string
  provider?: string
  start_time: string
  start_time_local: string
  timezone: string
  summary: string
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
  const summary = provider
    ? `${visit} with ${provider} on ${localWhen}`
    : `${visit} on ${localWhen}`

  return {
    id: appt.id,
    status: appt.status,
    visit_type: appt.visitType?.trim() || undefined,
    reason: appt.reason?.trim() || undefined,
    provider,
    start_time: appt.startTime.toISOString(),
    start_time_local: localWhen,
    timezone: timeZone,
    summary,
  }
}
