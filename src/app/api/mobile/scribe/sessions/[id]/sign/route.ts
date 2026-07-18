import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { serializeScribeSession } from '@/lib/aria/serialize'
import { signAriaSession } from '@/lib/aria/sign'

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
    const session = await signAriaSession({
      sessionId: id,
      practiceId: user.practiceId,
      userId: user.id,
    })

    return NextResponse.json({ session: serializeScribeSession(session) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Session not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('[mobile/scribe/sign POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
