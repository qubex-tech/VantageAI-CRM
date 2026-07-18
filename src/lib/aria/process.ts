import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isAriaScribeEnabled } from '@/lib/aria/enabled'
import { loadAriaPatientContext, type AriaPatientContext } from '@/lib/aria/context'
import { generateAriaSoapNote, transcribeAriaAudio } from '@/lib/aria/generate'
import { notifyUsers } from '@/lib/push-notifications'

type ChunkRow = {
  seq: number
  kind: string
  mimeType: string
  audioData: Buffer | Uint8Array | null
  transcript: string | null
}

export type AriaFreshAudio = {
  buffer: Buffer
  mimeType: string
  kind: 'ambient' | 'dictation'
  durationMs?: number | null
}

/**
 * Prefetch chart context at session start so Stop only waits on ASR + SOAP.
 */
export async function prefetchAriaContext(params: {
  sessionId: string
  practiceId: string
  patientId: string
  appointmentId?: string | null
}): Promise<void> {
  try {
    const context = await loadAriaPatientContext({
      practiceId: params.practiceId,
      patientId: params.patientId,
      appointmentId: params.appointmentId,
    })
    const session = await prisma.scribeSession.findFirst({
      where: { id: params.sessionId, practiceId: params.practiceId },
      select: { rawModelMeta: true },
    })
    const existing =
      session?.rawModelMeta && typeof session.rawModelMeta === 'object'
        ? (session.rawModelMeta as Record<string, unknown>)
        : {}
    await prisma.scribeSession.update({
      where: { id: params.sessionId },
      data: {
        rawModelMeta: {
          ...existing,
          contextPrefetch: context,
          contextPrefetchAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.warn('[aria] context prefetch failed', err)
  }
}

function contextFromPrefetch(raw: unknown): AriaPatientContext | null {
  if (!raw || typeof raw !== 'object') return null
  const meta = raw as Record<string, unknown>
  const prefetch = meta.contextPrefetch
  if (!prefetch || typeof prefetch !== 'object') return null
  const p = prefetch as Partial<AriaPatientContext>
  if (typeof p.patientName !== 'string') return null
  return {
    patientName: p.patientName,
    visitType: p.visitType ?? null,
    reason: p.reason ?? null,
    snippets: Array.isArray(p.snippets) ? (p.snippets as AriaPatientContext['snippets']) : [],
  }
}

async function transcribeChunk(params: {
  sessionId: string
  seq: number
  kind: string
  mimeType: string
  buffer: Buffer
}): Promise<{ seq: number; kind: string; transcript: string; meta: Record<string, unknown> }> {
  const { transcript, meta } = await transcribeAriaAudio({
    audio: params.buffer,
    mimeType: params.mimeType,
    filename: `aria-${params.sessionId}-${params.seq}`,
  })
  return {
    seq: params.seq,
    kind: params.kind,
    transcript: transcript.trim(),
    meta,
  }
}

/**
 * Fast Aria pipeline:
 * - Whisper all pending chunks in parallel
 * - Load patient context in parallel with ASR (or reuse session prefetch)
 * - Then a single SOAP generation call
 */
export async function runAriaSessionPipeline(params: {
  sessionId: string
  practiceId: string
  notify?: boolean
  /** When provided, persist + transcribe this audio without an extra DB round-trip for ASR */
  freshAudio?: AriaFreshAudio
}): Promise<{ sessionId: string; status: string; skipped?: boolean; reason?: string }> {
  const { sessionId, practiceId } = params
  const notify = params.notify !== false
  const pipelineStarted = Date.now()

  if (!(await isAriaScribeEnabled(practiceId))) {
    return { sessionId, status: 'skipped', skipped: true, reason: 'ARIA_DISABLED' }
  }

  const session = await prisma.scribeSession.findFirst({
    where: { id: sessionId, practiceId },
  })
  if (!session) throw new Error('Session not found')

  await prisma.scribeSession.update({
    where: { id: sessionId },
    data: { status: 'transcribing', error: null },
  })

  // Persist fresh audio + load existing chunks concurrently
  let freshSeq: number | null = null
  const persistFreshPromise = (async () => {
    if (!params.freshAudio) return null
    const last = await prisma.scribeAudioChunk.findFirst({
      where: { sessionId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    })
    const seq = (last?.seq ?? -1) + 1
    freshSeq = seq
    await prisma.scribeAudioChunk.create({
      data: {
        sessionId,
        seq,
        kind: params.freshAudio.kind,
        mimeType: params.freshAudio.mimeType,
        durationMs: params.freshAudio.durationMs ?? null,
        audioData: params.freshAudio.buffer,
        transcript: null,
      },
    })
    return seq
  })()

  const existingChunksPromise = prisma.scribeAudioChunk.findMany({
    where: { sessionId },
    orderBy: { seq: 'asc' },
    select: {
      seq: true,
      kind: true,
      mimeType: true,
      audioData: true,
      transcript: true,
    },
  })

  const contextPromise = (async (): Promise<AriaPatientContext> => {
    const cached = contextFromPrefetch(session.rawModelMeta)
    if (cached) return cached
    return loadAriaPatientContext({
      practiceId,
      patientId: session.patientId,
      appointmentId: session.appointmentId,
    })
  })()

  const [, existingChunks, context] = await Promise.all([
    persistFreshPromise,
    existingChunksPromise,
    contextPromise,
  ])

  const chunks: ChunkRow[] = existingChunks.map((c) => ({
    seq: c.seq,
    kind: c.kind,
    mimeType: c.mimeType,
    audioData: c.audioData,
    transcript: c.transcript,
  }))

  // If fresh audio was just written, ensure it's in the list (race-safe)
  if (params.freshAudio && freshSeq != null && !chunks.some((c) => c.seq === freshSeq)) {
    chunks.push({
      seq: freshSeq,
      kind: params.freshAudio.kind,
      mimeType: params.freshAudio.mimeType,
      audioData: params.freshAudio.buffer,
      transcript: null,
    })
    chunks.sort((a, b) => a.seq - b.seq)
  }

  if (!chunks.length && !params.freshAudio) {
    await prisma.scribeSession.update({
      where: { id: sessionId },
      data: { status: 'failed', error: 'No audio chunks uploaded' },
    })
    throw new Error('No audio chunks uploaded')
  }

  // Fast path: reuse eagerly cached segment transcripts; ASR only what's missing
  // (typically just the final slice after rolling uploads).
  const cachedCount = chunks.filter((c) => c.transcript?.trim()).length
  const asrJobs = chunks.map(async (chunk) => {
    if (chunk.transcript?.trim()) {
      return {
        seq: chunk.seq,
        kind: chunk.kind,
        transcript: chunk.transcript.trim(),
        meta: { cached: true },
      }
    }

    let buffer: Buffer | null = null
    if (params.freshAudio && freshSeq != null && chunk.seq === freshSeq) {
      buffer = params.freshAudio.buffer
    } else if (chunk.audioData && chunk.audioData.length > 0) {
      buffer = Buffer.from(chunk.audioData)
    }
    if (!buffer) {
      return { seq: chunk.seq, kind: chunk.kind, transcript: '', meta: { empty: true } }
    }

    const result = await transcribeChunk({
      sessionId,
      seq: chunk.seq,
      kind: chunk.kind,
      mimeType: chunk.mimeType,
      buffer,
    })

    await prisma.scribeAudioChunk.updateMany({
      where: { sessionId, seq: chunk.seq },
      data: { transcript: result.transcript || null },
    })

    return result
  })

  const asrResults = await Promise.all(asrJobs)
  asrResults.sort((a, b) => a.seq - b.seq)

  const parts = asrResults
    .filter((r) => r.transcript)
    .map((r) => `${r.kind === 'dictation' ? '[Dictation]' : '[Visit]'}\n${r.transcript}`)

  const transcript = parts.join('\n\n').trim()
  if (!transcript) {
    await prisma.scribeSession.update({
      where: { id: sessionId },
      data: { status: 'failed', error: 'Transcription produced empty text' },
    })
    throw new Error('Transcription produced empty text')
  }

  const asrMeta = asrResults.map((r) => ({ seq: r.seq, ...r.meta }))
  const asrDoneAt = Date.now()
  const pendingAsr = chunks.length - cachedCount

  await prisma.scribeSession.update({
    where: { id: sessionId },
    data: {
      transcript,
      status: 'generating',
      rawModelMeta: {
        ...(typeof session.rawModelMeta === 'object' && session.rawModelMeta
          ? (session.rawModelMeta as Record<string, unknown>)
          : {}),
        asr: asrMeta,
        timings: {
          asrMs: asrDoneAt - pipelineStarted,
          cachedSegments: cachedCount,
          pendingAsrSegments: Math.max(0, pendingAsr),
        },
      } as Prisma.InputJsonValue,
    },
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
      rawModelMeta: {
        ...existingMeta,
        asr: asrMeta,
        generation: meta,
        timings: {
          asrMs: asrDoneAt - pipelineStarted,
          totalMs: Date.now() - pipelineStarted,
        },
      } as Prisma.InputJsonValue,
      error: null,
    },
  })

  // Drop heavy audio after success (keep transcripts)
  await prisma.scribeAudioChunk.updateMany({
    where: { sessionId },
    data: { audioData: null },
  })

  if (notify) {
    // Don't block the clinician on push delivery
    void notifyUsers([session.providerUserId], {
      title: 'Aria: note ready',
      body: 'Your draft visit note is ready for review.',
      data: { type: 'aria_note_ready', sessionId },
    }).catch(() => null)
  }

  return { sessionId, status: 'ready_for_review' }
}
