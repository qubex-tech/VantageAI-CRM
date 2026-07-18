import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import {
  isOpenSlotFilled,
  syncOpenSlotLifecycle,
} from '@/lib/appointment-optimization/slotFilled'

/**
 * GET /api/appointment-optimization/slots/[id]/status
 * Re-check occupancy + past-time exhaustion (Active → filled/exhausted).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
    }

    const slot = await prisma.openSlotEvent.findFirst({
      where: { id, practiceId: user.practiceId },
      select: { id: true },
    })
    if (!slot) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await syncOpenSlotLifecycle(id)
    const occupied = await isOpenSlotFilled(id)

    const updated = await prisma.openSlotEvent.findUnique({
      where: { id },
      include: {
        waves: { orderBy: { waveNumber: 'asc' } },
        _count: { select: { attempts: true } },
      },
    })

    return NextResponse.json({
      openSlotEventId: id,
      filled: occupied,
      status: updated?.status,
      slot: updated,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
