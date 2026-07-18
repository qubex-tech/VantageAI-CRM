import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isAriaScribeEnabled } from '@/lib/aria/enabled'
import { loadAriaPatientContext } from '@/lib/aria/context'
import { generateAriaSoapNote, transcribeAriaAudio } from '@/lib/aria/generate'
import { notifyUsers } from '@/lib/push-notifications'

/**
 * Core Aria pipeline (ASR → SOAP). Used by Inngest and by the sync/process API fallback.
 */
export async function runAriaSessionPipeline(params: {
  sessionId: string
  practiceId: string
  notify?: boolean
}): Promise<{ sessionId: string; status: string; skipped?: boolean; reason?: string }> {
  const { sessionId, practiceId } = params
  const notify = params.notify !== false

  if (!(await isAriaScribeEnabled(practiceId))) {
    return { sessionId, status: 'skipped', skipped: true, reason: 'ARIA_DISABLED' }
  }

  await prisma.scribeSession.updateMany({
    where: {
      id: sessionId,
      practiceId,
      status: { in: ['recording', 'uploading', 'failed', 'ready_for_review', 'transcribing', 'generating'] },
    },
    data: { status: 'transcribing', error: null },
  })

  const chunks = await prisma.scribeAudioChunk.findMany({
    where: { sessionId },
    orderBy: { seq: 'asc' },
    select: { audioData: true, mimeType: true, kind: true, seq: true },
  })

  if (!chunks.length) {
    await prisma.scribeSession.update({
      where: { id: sessionId },
      data: { status: 'failed', error: 'No audio chunks uploaded' },
    })
    throw new Error('No audio chunks uploaded')
  }

  const parts: string[] = []
  const asrMeta: Record<string, unknown>[] = []

  for (const chunk of chunks) {
    if (!chunk.audioData || chunk.audioData.length === 0) continue
    const buffer = Buffer.from(chunk.audioData)
    const { transcript, meta } = await transcribeAriaAudio({
      audio: buffer,
      mimeType: chunk.mimeType,
      filename: `aria-${sessionId}-${chunk.seq}`,
    })
    asrMeta.push(meta)
    if (transcript) {
      const label = chunk.kind === 'dictation' ? '[Dictation]' : '[Visit]'
      parts.push(`${label}\n${transcript}`)
    }
  }

  const transcript = parts.join('\n\n').trim()
  if (!transcript) {
    await prisma.scribeSession.update({
      where: { id: sessionId },
      data: { status: 'failed', error: 'Transcription produced empty text' },
    })
    throw new Error('Transcription produced empty text')
  }

  await prisma.scribeSession.update({
    where: { id: sessionId },
    data: {
      transcript,
      rawModelMeta: { asr: asrMeta } as Prisma.InputJsonValue,
      status: 'generating',
    },
  })

  const session = await prisma.scribeSession.findFirst({
    where: { id: sessionId, practiceId },
  })
  if (!session) throw new Error('Session not found')

  const context = await loadAriaPatientContext({
    practiceId,
    patientId: session.patientId,
    appointmentId: session.appointmentId,
  })

  const { soap, meta } = await generateAriaSoapNote({
    transcript,
    patientName: context.patientName,
    visitType: context.visitType,
    reason: context.reason,
    contextSnippets: context.snippets,
  })

  const existingMeta =
    session.rawModelMeta && typeof session.rawModelMeta === 'object'
      ? (session.rawModelMeta as Record<string, unknown>)
      : {}

  await prisma.scribeSession.update({
    where: { id: sessionId },
    data: {
      soapJson: soap as unknown as Prisma.InputJsonValue,
      status: 'ready_for_review',
      rawModelMeta: { ...existingMeta, asr: asrMeta, generation: meta } as Prisma.InputJsonValue,
      error: null,
    },
  })

  await prisma.scribeAudioChunk.updateMany({
    where: { sessionId },
    data: { audioData: null },
  })

  if (notify) {
    await notifyUsers([session.providerUserId], {
      title: 'Aria: note ready',
      body: 'Your draft visit note is ready for review.',
      data: { type: 'aria_note_ready', sessionId },
    })
  }

  return { sessionId, status: 'ready_for_review' }
}
