import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { runAriaSessionPipeline } from '@/lib/aria/process'
import { serializeScribeSession } from '@/lib/aria/serialize'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/mobile/scribe/sessions/:id/process
 * Synchronously run (or re-run) the Aria ASR + SOAP pipeline.
 * Used when Inngest is delayed/unavailable, and for manual retry.
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
      include: { chunks: { select: { id: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (['signed', 'discarded'].includes(existing.status)) {
      return NextResponse.json({ error: 'Session is closed' }, { status: 400 })
    }
    if (!existing.chunks.length) {
      return NextResponse.json({ error: 'No audio uploaded' }, { status: 400 })
    }

    try {
      await runAriaSessionPipeline({
        sessionId: id,
        practiceId: user.practiceId,
        notify: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed'
      await prisma.scribeSession.updateMany({
        where: { id, practiceId: user.practiceId },
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

    return NextResponse.json({ session: session ? serializeScribeSession(session) : null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/process POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
