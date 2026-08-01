import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { transcribeAriaAudio } from '@/lib/aria/generate'

const MAX_BYTES = 25 * 1024 * 1024

export type PebbleIngestInput = {
  sessionId: string
  practiceId: string
  audio: Buffer | null
  mimeType: string
  pebbleTranscription: string | null
  recordedAtMs: number | null
  trigger: string | null
  client: string | null
}

export type PebbleIngestResult = {
  chunkId: string
  seq: number
  transcript: string
  asrSource: 'aria' | 'pebble' | 'none'
  /** True when SOAP was regenerated after append (review/addendum path) */
  regenerated: boolean
}

/**
 * Append an Index ring dictation to an open Aria session as kind=dictation.
 * Prefers Aria Whisper when audio is present; falls back to Pebble transcription.
 */
export async function ingestPebbleDictationToSession(
  input: PebbleIngestInput
): Promise<PebbleIngestResult> {
  if (!input.audio && !input.pebbleTranscription?.trim()) {
    throw new Error('audio or transcription is required')
  }
  if (input.audio && input.audio.length > MAX_BYTES) {
    throw new Error('Audio file too large (max 25MB)')
  }

  const session = await prisma.scribeSession.findFirst({
    where: { id: input.sessionId, practiceId: input.practiceId },
    select: { id: true, status: true, rawModelMeta: true },
  })
  if (!session) {
    throw new Error('Session not found')
  }
  if (['signed', 'discarded'].includes(session.status)) {
    throw new Error('Session is closed')
  }

  const shouldRegenerateSoap =
    session.status === 'ready_for_review' || session.status === 'failed'

  const last = await prisma.scribeAudioChunk.findFirst({
    where: { sessionId: input.sessionId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  })
  const seq = (last?.seq ?? -1) + 1

  const sha256 = input.audio ? createHash('sha256').update(input.audio).digest('hex') : null
  const mimeType = input.mimeType || 'audio/mp4'

  const chunk = await prisma.scribeAudioChunk.create({
    data: {
      sessionId: input.sessionId,
      seq,
      kind: 'dictation',
      mimeType,
      durationMs: null,
      sha256,
      audioData: input.audio,
      transcript: null,
    },
    select: { id: true, seq: true },
  })

  const nextStatus =
    session.status === 'recording' || session.status === 'uploading' ? 'recording' : 'uploading'

  await prisma.scribeSession.update({
    where: { id: input.sessionId },
    data: {
      status: nextStatus,
      mode: 'hybrid',
    },
  })

  let transcript = ''
  let asrSource: PebbleIngestResult['asrSource'] = 'none'
  let asrMeta: Record<string, unknown> = {}

  if (input.audio) {
    try {
      const result = await transcribeAriaAudio({
        audio: input.audio,
        mimeType,
        filename: `pebble-${input.sessionId}-${seq}`,
      })
      transcript = result.transcript?.trim() || ''
      asrMeta = result.meta
      if (transcript) asrSource = 'aria'
    } catch (asrErr) {
      asrMeta = {
        error: asrErr instanceof Error ? asrErr.message : 'asr_failed',
      }
    }
  }

  if (!transcript && input.pebbleTranscription?.trim()) {
    transcript = input.pebbleTranscription.trim()
    asrSource = 'pebble'
  }

  if (transcript || input.audio) {
    await prisma.scribeAudioChunk.update({
      where: { id: chunk.id },
      data: {
        transcript: transcript || null,
        // Drop bytes once we have a transcript (same as mobile chunk path)
        audioData: transcript ? null : input.audio,
      },
    })
  }

  const existingMeta =
    session.rawModelMeta && typeof session.rawModelMeta === 'object'
      ? (session.rawModelMeta as Record<string, unknown>)
      : {}
  const progressive = Array.isArray(existingMeta.progressiveAsr)
    ? [...(existingMeta.progressiveAsr as unknown[])]
    : []
  progressive.push({
    seq,
    chars: transcript.length,
    source: 'pebble_index',
    asrSource,
    ...asrMeta,
  })

  const pebbleMeta = {
    ...(typeof existingMeta.pebble === 'object' && existingMeta.pebble
      ? (existingMeta.pebble as Record<string, unknown>)
      : {}),
    lastIngestAt: new Date().toISOString(),
    lastRecordedAtMs: input.recordedAtMs,
    lastTrigger: input.trigger,
    lastClient: input.client ?? 'ring',
    lastAsrSource: asrSource,
  }

  await prisma.scribeSession.update({
    where: { id: input.sessionId },
    data: {
      rawModelMeta: {
        ...existingMeta,
        progressiveAsr: progressive,
        pebble: pebbleMeta,
      } as unknown as Prisma.InputJsonValue,
    },
  })

  let regenerated = false
  if (shouldRegenerateSoap && transcript) {
    const { runAriaSessionPipeline } = await import('@/lib/aria/process')
    await runAriaSessionPipeline({
      sessionId: input.sessionId,
      practiceId: input.practiceId,
      notify: true,
    })
    regenerated = true
  }

  return {
    chunkId: chunk.id,
    seq: chunk.seq,
    transcript,
    asrSource,
    regenerated,
  }
}
