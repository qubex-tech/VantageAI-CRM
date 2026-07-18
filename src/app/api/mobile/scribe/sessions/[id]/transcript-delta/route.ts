import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/mobile/scribe/sessions/:id/transcript-delta
 * Append committed Deepgram finals onto the session transcript.
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
      select: { id: true, status: true, transcript: true, rawModelMeta: true },
    })
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (['signed', 'discarded'].includes(session.status)) {
      return NextResponse.json({ error: 'Session is closed' }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as {
      finals?: unknown
      isFinalFlush?: unknown
    } | null

    const finals = Array.isArray(body?.finals)
      ? body!.finals
          .filter((f): f is string => typeof f === 'string')
          .map((f) => f.trim())
          .filter(Boolean)
      : []

    if (!finals.length) {
      return NextResponse.json({
        transcript: session.transcript || '',
        appendedChars: 0,
        ackCount: 0,
      })
    }

    const addition = finals.join(' ').replace(/\s+/g, ' ').trim()
    const prev = (session.transcript || '').trim()
    const next = prev ? `${prev} ${addition}`.trim() : addition

    const existingMeta =
      session.rawModelMeta && typeof session.rawModelMeta === 'object'
        ? (session.rawModelMeta as Record<string, unknown>)
        : {}
    const streamMeta =
      existingMeta.stream && typeof existingMeta.stream === 'object'
        ? (existingMeta.stream as Record<string, unknown>)
        : {}

    const nextStatus =
      session.status === 'recording' || session.status === 'uploading'
        ? 'recording'
        : session.status

    await prisma.scribeSession.update({
      where: { id },
      data: {
        transcript: next,
        status: nextStatus,
        rawModelMeta: {
          ...existingMeta,
          stream: {
            ...streamMeta,
            provider: 'deepgram',
            lastDeltaAt: new Date().toISOString(),
            finalsCount: (typeof streamMeta.finalsCount === 'number' ? streamMeta.finalsCount : 0) + finals.length,
            chars: next.length,
            isFinalFlush: Boolean(body?.isFinalFlush),
          },
        } as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({
      transcript: next,
      appendedChars: addition.length,
      ackCount: finals.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/transcript-delta POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
