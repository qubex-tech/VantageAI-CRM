import { prisma } from '@/lib/db'
import { formatSoapAsText, parseSoapJson } from '@/lib/aria/types'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'

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

  return prisma.scribeSession.update({
    where: { id: session.id },
    data: {
      status: 'signed',
      patientNoteId: note.id,
      ehrDocumentReferenceId,
      ehrWritebackStatus,
      ehrWritebackError,
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
