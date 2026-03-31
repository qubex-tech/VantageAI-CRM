import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    // Fetch calls from the existing /api/calls endpoint logic
    // Use the RetellAI client from the practice's integration
    if (!user.practiceId) {
      return NextResponse.json({ calls: [], reviewedCallIds: [] })
    }

    const { getRetellClient } = await import('@/lib/retell-api')
    let retell: any = null
    try {
      retell = await getRetellClient(user.practiceId)
    } catch {
      // Practice has no RetellAI integration configured — return empty list
      return NextResponse.json({ calls: [], reviewedCallIds: [] })
    }

    // Fetch reviewed call IDs for this practice
    const reviews = await prisma.callReview.findMany({
      where: { practiceId: user.practiceId },
      select: { callId: true },
    })
    const reviewedCallIds = reviews.map((r) => r.callId)

    // listCalls matches the web /api/calls route which uses retellClient.listCalls()
    const result = await retell.listCalls({ limit, offset })
    const calls: any[] = result?.calls ?? []

    return NextResponse.json({ calls, reviewedCallIds })
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/calls GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
