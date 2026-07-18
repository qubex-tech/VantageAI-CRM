import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { runAriaSessionPipeline } from '@/lib/aria/process'
import { serializeScribeSession } from '@/lib/aria/serialize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

type RouteContext = { params: Promise<{ id: string }> }

const MAX_BYTES = 25 * 1024 * 1024

/**
 * POST /api/mobile/scribe/sessions/:id/finalize
 * Single fast path: accept audio + run parallel ASR/context + SOAP in one request.
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
    const existing = await prisma.scribeSession.findFirst({
      where: { id, practiceId: user.practiceId },
      select: { id: true, status: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (['signed', 'discarded'].includes(existing.status)) {
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

    await prisma.scribeSession.update({
      where: { id },
      data: {
        status: 'uploading',
        endedAt: new Date(),
        error: null,
        mode: kind === 'dictation' ? 'hybrid' : undefined,
      },
    })

    try {
      await runAriaSessionPipeline({
        sessionId: id,
        practiceId: user.practiceId,
        notify: true,
        freshAudio: {
          buffer,
          mimeType: file.type || 'audio/m4a',
          kind,
          durationMs: Number.isFinite(durationMs) ? durationMs : null,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed'
      await prisma.scribeSession.update({
        where: { id },
        data: { status: 'failed', error: message },
      })
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const session = await prisma.scribeSession.findFirst({
      where: { id, practiceId: user.practiceId },
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

    return NextResponse.json({
      session: session ? serializeScribeSession(session) : null,
      processing: 'fast_finalize',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/finalize POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
