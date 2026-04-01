import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) return NextResponse.json({ error: 'No practice' }, { status: 400 })
    await prisma.callReview.upsert({
      where: { callId_practiceId_userId: { callId: params.id, practiceId: user.practiceId, userId: user.id } },
      create: { callId: params.id, practiceId: user.practiceId, userId: user.id },
      update: { reviewedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('[mobile/calls/[id]/review POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
