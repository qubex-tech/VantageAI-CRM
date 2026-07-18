import type { ScribeSession } from '@prisma/client'
import { parseSoapJson } from '@/lib/aria/types'

export function serializeScribeSession(
  session: ScribeSession & {
    patient?: {
      id: string
      name: string
      firstName: string | null
      lastName: string | null
      dateOfBirth: Date | null
    } | null
  }
) {
  const patientName = session.patient
    ? [session.patient.firstName, session.patient.lastName].filter(Boolean).join(' ').trim() ||
      session.patient.name
    : null

  return {
    id: session.id,
    practiceId: session.practiceId,
    patientId: session.patientId,
    appointmentId: session.appointmentId,
    providerUserId: session.providerUserId,
    mode: session.mode,
    status: session.status,
    consentAt: session.consentAt?.toISOString() ?? null,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    transcript: session.transcript,
    soap: parseSoapJson(session.soapJson),
    patientNoteId: session.patientNoteId,
    ehrDocumentReferenceId: session.ehrDocumentReferenceId,
    ehrWritebackStatus: session.ehrWritebackStatus,
    ehrWritebackError: session.ehrWritebackError,
    error: session.error,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    patient: session.patient
      ? {
          id: session.patient.id,
          name: patientName,
          firstName: session.patient.firstName,
          lastName: session.patient.lastName,
          dateOfBirth: session.patient.dateOfBirth?.toISOString() ?? null,
        }
      : null,
  }
}
