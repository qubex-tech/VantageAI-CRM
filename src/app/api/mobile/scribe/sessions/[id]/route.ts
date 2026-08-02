import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { serializeScribeSession } from '@/lib/aria/serialize'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
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
        chunks: {
          orderBy: { seq: 'asc' },
          select: { seq: true, kind: true, transcript: true },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const serialized = serializeScribeSession(session)
    const liveFromChunks = session.chunks
      .map((chunk) => (chunk.transcript || '').trim())
      .filter(Boolean)
      .join('\n\n')

    return NextResponse.json({
      session: {
        ...serialized,
        transcript: serialized.transcript || liveFromChunks || null,
        chunkCount: session.chunks.length,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
