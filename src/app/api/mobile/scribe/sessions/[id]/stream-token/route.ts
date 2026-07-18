import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import {
  deepgramUnavailableResponse,
  grantDeepgramStreamToken,
  isDeepgramConfigured,
} from '@/lib/aria/deepgram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/mobile/scribe/sessions/:id/stream-token
 * Mint a short-lived Deepgram token for mobile → Deepgram live STT.
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
    if (!isDeepgramConfigured()) {
      return NextResponse.json(deepgramUnavailableResponse(), { status: 503 })
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

    const grant = await grantDeepgramStreamToken({ ttlSeconds: 600 })
    return NextResponse.json({
      accessToken: grant.accessToken,
      expiresIn: grant.expiresIn,
      model: grant.model,
      listenUrl: grant.listenUrl,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'DEEPGRAM_NOT_CONFIGURED') {
      return NextResponse.json(deepgramUnavailableResponse(), { status: 503 })
    }
    console.error('[mobile/scribe/stream-token POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
