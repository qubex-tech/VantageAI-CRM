import { prisma } from '@/lib/db'
import { getOpenDentalConnection, getOpenDentalServices } from '@/lib/integrations/opendental/factory'
import { parseOpenDentalAptNumFromBookingId } from '@/lib/integrations/opendental/appointmentSync'
import { logOpenDentalAudit } from '@/lib/integrations/opendental/audit'
import { formatSoapAsText, type AriaSoapNote } from '@/lib/aria/types'

const MAX_NOTE_LENGTH = 4000

export type AriaOdAppointmentNoteResult =
  | { status: 'success'; aptNum: number }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string }

function markerForSession(sessionId: string): string {
  return `--- Aria Scribe (${sessionId.slice(0, 8)}) ---`
}

function buildAriaAppointmentNoteBlock(params: {
  sessionId: string
  soap: AriaSoapNote
}): string {
  const body = formatSoapAsText(params.soap).trim()
  return `${markerForSession(params.sessionId)}\n${body}`
}

/** Replace an existing Aria block for this session, or append a new one. */
export function mergeAriaIntoAppointmentNote(params: {
  existingNote: string
  sessionId: string
  soap: AriaSoapNote
}): string {
  const block = buildAriaAppointmentNoteBlock(params)
  const marker = markerForSession(params.sessionId)
  const existing = (params.existingNote || '').trim()

  if (!existing) return block

  if (existing.includes(marker)) {
    const parts = existing.split(marker)
    const before = parts[0].trimEnd()
    // Drop previous Aria body through end (or until another --- Aria marker)
    const afterRaw = parts.slice(1).join(marker)
    const nextMarker = afterRaw.search(/\n--- Aria Scribe \(/)
    const after =
      nextMarker >= 0 ? afterRaw.slice(nextMarker).trim() : ''
    return [before, block, after].filter(Boolean).join('\n\n').trim()
  }

  return `${existing}\n\n${block}`.trim()
}

function truncateNote(note: string): string {
  if (note.length <= MAX_NOTE_LENGTH) return note
  return `${note.slice(0, MAX_NOTE_LENGTH - 20)}\n…[truncated]`
}

/**
 * Write Aria's signed SOAP into the Open Dental Appointment Note field
 * for the linked CRM appointment (`calBookingId = opendental:apt:{AptNum}`).
 */
export async function syncAriaNoteToOpenDentalAppointment(params: {
  practiceId: string
  patientId: string
  appointmentId?: string | null
  sessionId: string
  soap: AriaSoapNote
  actorUserId?: string
}): Promise<AriaOdAppointmentNoteResult> {
  const connection = await getOpenDentalConnection(params.practiceId)
  if (!connection?.isActive) {
    return { status: 'skipped', reason: 'opendental_not_configured' }
  }

  if (!params.appointmentId) {
    return { status: 'skipped', reason: 'no_appointment_on_session' }
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: params.appointmentId,
      practiceId: params.practiceId,
      patientId: params.patientId,
    },
    select: { id: true, calBookingId: true, notes: true },
  })

  if (!appointment) {
    return { status: 'skipped', reason: 'appointment_not_found' }
  }

  const aptNum = parseOpenDentalAptNumFromBookingId(appointment.calBookingId)
  if (!aptNum) {
    return { status: 'skipped', reason: 'appointment_not_linked_to_opendental' }
  }

  try {
    const services = await getOpenDentalServices(params.practiceId)
    const od = (await services.appointments.get(aptNum)) as { Note?: string } | null
    const existingOdNote = typeof od?.Note === 'string' ? od.Note : ''

    // Prefer live OD note; fall back to CRM notes if OD get returns empty.
    const baseNote = existingOdNote.trim() || (appointment.notes || '').trim()
    const nextNote = truncateNote(
      mergeAriaIntoAppointmentNote({
        existingNote: baseNote,
        sessionId: params.sessionId,
        soap: params.soap,
      })
    )

    await services.appointments.update(aptNum, { Note: nextNote })

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notes: nextNote },
    })

    await logOpenDentalAudit({
      tenantId: params.practiceId,
      actorUserId: params.actorUserId,
      action: 'appointment.aria_note_synced',
      entity: 'Appointment',
      entityId: String(aptNum),
      metadata: {
        aptNum,
        patientId: params.patientId,
        appointmentId: appointment.id,
        sessionId: params.sessionId,
      },
    })

    return { status: 'success', aptNum }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Open Dental appointment note write failed'
    return { status: 'error', reason: message }
  }
}
