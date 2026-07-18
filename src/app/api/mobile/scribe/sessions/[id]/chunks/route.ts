import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const MAX_BYTES = 25 * 1024 * 1024

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
      select: { id: true, status: true },
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
        mimeType: file.type || 'audio/m4a',
        durationMs: Number.isFinite(durationMs) ? durationMs : null,
        sha256,
        audioData: buffer,
      },
      select: { id: true, seq: true, kind: true, durationMs: true, uploadedAt: true },
    })

    await prisma.scribeSession.update({
      where: { id },
      data: {
        status: session.status === 'ready_for_review' ? 'uploading' : 'uploading',
        mode: kind === 'dictation' ? 'hybrid' : undefined,
      },
    })

    return NextResponse.json({ chunk }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/chunks POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
