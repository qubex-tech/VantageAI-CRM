import { Prisma } from '@prisma/client'
import { inngest } from '@/inngest/client'
import { prisma } from '@/lib/db'
import { isAriaScribeEnabled } from '@/lib/aria/enabled'
import { loadAriaPatientContext } from '@/lib/aria/context'
import { generateAriaSoapNote, transcribeAriaAudio } from '@/lib/aria/generate'
import { notifyUsers } from '@/lib/push-notifications'

export const processAriaSession = inngest.createFunction(
  {
    id: 'process-aria-session',
    name: 'Process Aria Scribe Session',
    retries: 2,
    concurrency: { limit: 4, key: 'event.data.practiceId' },
  },
  { event: 'aria/session.process' },
  async ({ event, step }) => {
    const { sessionId, practiceId } = event.data as {
      sessionId: string
      practiceId: string
    }

    const enabled = await step.run('check-enabled', async () => isAriaScribeEnabled(practiceId))
    if (!enabled) {
      return { skipped: true, reason: 'ARIA_DISABLED' }
    }

    await step.run('mark-transcribing', async () => {
      await prisma.scribeSession.updateMany({
        where: {
          id: sessionId,
          practiceId,
          status: { in: ['recording', 'uploading', 'failed', 'ready_for_review'] },
        },
        data: { status: 'transcribing', error: null },
      })
    })

    const transcriptResult = await step.run('transcribe', async () => {
      const chunks = await prisma.scribeAudioChunk.findMany({
        where: { sessionId },
        orderBy: { seq: 'asc' },
        select: { audioData: true, mimeType: true, kind: true, seq: true },
      })

      if (!chunks.length) {
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

      return { transcript }
    })

    const generation = await step.run('generate-soap', async () => {
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
        transcript: transcriptResult.transcript,
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
          rawModelMeta: { ...existingMeta, generation: meta } as Prisma.InputJsonValue,
          error: null,
        },
      })

      // Best-effort: drop audio bytes after successful generation
      await prisma.scribeAudioChunk.updateMany({
        where: { sessionId },
        data: { audioData: null },
      })

      return { soap, providerUserId: session.providerUserId }
    })

    await step.run('notify-provider', async () => {
      await notifyUsers([generation.providerUserId], {
        title: 'Aria: note ready',
        body: 'Your draft visit note is ready for review.',
        data: { type: 'aria_note_ready', sessionId },
      })
    })

    return { sessionId, status: 'ready_for_review' }
  }
)
