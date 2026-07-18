import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { inngest } from '@/inngest/client'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { serializeScribeSession } from '@/lib/aria/serialize'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

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
      include: {
        chunks: { select: { id: true } },
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

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (['signed', 'discarded'].includes(existing.status)) {
      return NextResponse.json({ error: 'Session is closed' }, { status: 400 })
    }
    if (!existing.chunks.length) {
      return NextResponse.json({ error: 'Upload audio before stopping' }, { status: 400 })
    }

    const session = await prisma.scribeSession.update({
      where: { id },
      data: {
        status: 'uploading',
        endedAt: existing.endedAt ?? new Date(),
        error: null,
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

    await inngest.send({
      name: 'aria/session.process',
      data: {
        sessionId: session.id,
        practiceId: user.practiceId,
      },
    })

    return NextResponse.json({ session: serializeScribeSession(session) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/stop POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
