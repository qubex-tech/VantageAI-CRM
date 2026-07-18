import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { formatSoapAsText, parseSoapJson } from '@/lib/aria/types'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import { syncAriaNoteToOpenDentalAppointment } from '@/lib/aria/opendentalAppointmentNote'

export async function signAriaSession(params: {
  sessionId: string
  practiceId: string
  userId: string
}) {
  const session = await prisma.scribeSession.findFirst({
    where: {
      id: params.sessionId,
      practiceId: params.practiceId,
    },
  })

  if (!session) {
    throw new Error('Session not found')
  }

  if (session.status === 'signed') {
    return session
  }

  if (session.status !== 'ready_for_review') {
    throw new Error(`Session cannot be signed from status ${session.status}`)
  }

  const soap = parseSoapJson(session.soapJson)
  const content = formatSoapAsText(soap)
  if (!content.replace(/[—\s]/g, '').length) {
    throw new Error('Note is empty')
  }

  const note = await prisma.patientNote.create({
    data: {
      practiceId: params.practiceId,
      patientId: session.patientId,
      userId: params.userId,
      type: 'onsite_visit',
      content: `Aria Scribe Note\n\n${content}`,
    },
  })

  let ehrDocumentReferenceId: string | null = null
  let ehrWritebackStatus = 'skipped'
  let ehrWritebackError: string | null = null

  try {
    const ehrSync = await syncPatientNoteToEhr({
      practiceId: params.practiceId,
      patientId: session.patientId,
      noteType: 'onsite_visit',
      content: `DRAFT - Aria Scribe Note\n\n${content}`,
      actorUserId: params.userId,
    })

    if (ehrSync.status === 'success') {
      ehrWritebackStatus = 'success'
      ehrDocumentReferenceId = ehrSync.documentReferenceId ?? null
    } else if (ehrSync.status === 'error') {
      ehrWritebackStatus = 'failed'
      ehrWritebackError = ehrSync.reason
    } else {
      ehrWritebackStatus = 'skipped'
      ehrWritebackError = ehrSync.reason
    }
  } catch (err) {
    ehrWritebackStatus = 'failed'
    ehrWritebackError = err instanceof Error ? err.message : 'EHR writeback failed'
  }

  // Open Dental: append Aria SOAP into the linked appointment's Note field.
  let openDentalWriteback: Record<string, unknown> = { status: 'skipped' }
  try {
    const odSync = await syncAriaNoteToOpenDentalAppointment({
      practiceId: params.practiceId,
      patientId: session.patientId,
      appointmentId: session.appointmentId,
      sessionId: session.id,
      soap,
      actorUserId: params.userId,
    })
    openDentalWriteback = { ...odSync }
    // If eCW was skipped but OD succeeded, surface OD as the primary writeback success.
    if (odSync.status === 'success' && ehrWritebackStatus === 'skipped') {
      ehrWritebackStatus = 'success'
      ehrWritebackError = `opendental_appointment_note:${odSync.aptNum}`
    } else if (odSync.status === 'error' && ehrWritebackStatus !== 'success') {
      ehrWritebackStatus = 'failed'
      ehrWritebackError = `opendental: ${odSync.reason}`
    } else if (odSync.status === 'skipped' && ehrWritebackStatus === 'skipped') {
      ehrWritebackError = [ehrWritebackError, `opendental: ${odSync.reason}`]
        .filter(Boolean)
        .join('; ')
    }
  } catch (err) {
    openDentalWriteback = {
      status: 'error',
      reason: err instanceof Error ? err.message : 'Open Dental writeback failed',
    }
    if (ehrWritebackStatus !== 'success') {
      ehrWritebackStatus = 'failed'
      ehrWritebackError = `opendental: ${openDentalWriteback.reason}`
    }
  }

  const existingMeta =
    session.rawModelMeta && typeof session.rawModelMeta === 'object'
      ? (session.rawModelMeta as Record<string, unknown>)
      : {}

  return prisma.scribeSession.update({
    where: { id: session.id },
    data: {
      status: 'signed',
      patientNoteId: note.id,
      ehrDocumentReferenceId,
      ehrWritebackStatus,
      ehrWritebackError,
      rawModelMeta: {
        ...existingMeta,
        openDentalAppointmentNote: openDentalWriteback,
      } as Prisma.InputJsonValue,
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
        },
      },
    },
  })
}
