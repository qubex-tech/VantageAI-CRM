import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)
    const { getRetellClient } = await import('@/lib/retell-api')
    const retell = await getRetellClient(user.practiceId)
    if (!retell) {
      return NextResponse.json({ error: 'Voice integration not configured' }, { status: 404 })
    }
    const call = await retell.call.retrieve(params.id)
    return NextResponse.json({ call })
  } catch (err: any) {
    if (err?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('[mobile/calls/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
