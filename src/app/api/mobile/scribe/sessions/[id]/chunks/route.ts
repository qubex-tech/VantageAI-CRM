import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { transcribeAriaAudio } from '@/lib/aria/generate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

type RouteContext = { params: Promise<{ id: string }> }

const MAX_BYTES = 25 * 1024 * 1024

/**
 * POST chunk — store audio and **eagerly Whisper** so ASR finishes during the visit.
 * Returns when transcript is cached (audio bytes cleared to keep DB light).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice required' }, { status: 400 })
    }
    if (!(await isAriaScribeEnabled(user.practiceId))) {
      return NextResponse.json(ariaDisabledResponse(), { status: 403 })
    }

    const { id } = await context.params
    const session = await prisma.scribeSession.findFirst({
      where: { id, practiceId: user.practiceId },
      select: { id: true, status: true, rawModelMeta: true },
    })
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (['signed', 'discarded'].includes(session.status)) {
      return NextResponse.json({ error: 'Session is closed' }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get('file')
    const kindRaw = String(form.get('kind') ?? 'ambient')
    const kind = kindRaw === 'dictation' ? 'dictation' : 'ambient'
    const durationMsRaw = form.get('durationMs')
    const durationMs =
      durationMsRaw != null && String(durationMsRaw).length
        ? parseInt(String(durationMsRaw), 10)
        : null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const mimeType = file.type || 'audio/m4a'

    const last = await prisma.scribeAudioChunk.findFirst({
      where: { sessionId: id },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    })
    const seq = (last?.seq ?? -1) + 1

    const chunk = await prisma.scribeAudioChunk.create({
      data: {
        sessionId: id,
        seq,
        kind,
        mimeType,
        durationMs: Number.isFinite(durationMs) ? durationMs : null,
        sha256,
        audioData: buffer,
      },
      select: { id: true, seq: true, kind: true, durationMs: true, uploadedAt: true },
    })

    // Keep session in recording while ambient segments stream in
    const nextStatus =
      session.status === 'recording' || session.status === 'uploading'
        ? 'recording'
        : 'uploading'

    await prisma.scribeSession.update({
      where: { id },
      data: {
        status: nextStatus,
        mode: kind === 'dictation' ? 'hybrid' : undefined,
      },
    })

    let transcript = ''
    let asrMeta: Record<string, unknown> = {}
    try {
      const result = await transcribeAriaAudio({
        audio: buffer,
        mimeType,
        filename: `aria-${id}-${seq}`,
      })
      transcript = result.transcript
      asrMeta = result.meta

      await prisma.scribeAudioChunk.update({
        where: { id: chunk.id },
        data: {
          transcript: transcript || null,
          // Bytes no longer needed once transcript is cached
          audioData: null,
        },
      })

      const existingMeta =
        session.rawModelMeta && typeof session.rawModelMeta === 'object'
          ? (session.rawModelMeta as Record<string, unknown>)
          : {}
      const progressive = Array.isArray(existingMeta.progressiveAsr)
        ? [...(existingMeta.progressiveAsr as unknown[])]
        : []
      progressive.push({ seq, chars: transcript.length, ...asrMeta })

      await prisma.scribeSession.update({
        where: { id },
        data: {
          rawModelMeta: {
            ...existingMeta,
            progressiveAsr: progressive,
          } as unknown as Prisma.InputJsonValue,
        },
      })
    } catch (asrErr) {
      console.error('[mobile/scribe/chunks] eager ASR failed; keeping audio for finalize', asrErr)
      asrMeta = {
        error: asrErr instanceof Error ? asrErr.message : 'asr_failed',
      }
    }

    return NextResponse.json(
      {
        chunk: {
          ...chunk,
          transcript,
          transcriptChars: transcript.length,
          asrCached: Boolean(transcript),
        },
        transcript,
        asr: asrMeta,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/chunks POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
