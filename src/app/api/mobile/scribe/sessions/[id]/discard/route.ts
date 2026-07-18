import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
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
    })
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (existing.status === 'signed') {
      return NextResponse.json({ error: 'Signed sessions cannot be discarded' }, { status: 400 })
    }

    await prisma.scribeAudioChunk.updateMany({
      where: { sessionId: id },
      data: { audioData: null },
    })

    const session = await prisma.scribeSession.update({
      where: { id },
      data: {
        status: 'discarded',
        transcript: null,
        soapJson: Prisma.DbNull,
        endedAt: existing.endedAt ?? new Date(),
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

    return NextResponse.json({ session: serializeScribeSession(session) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
