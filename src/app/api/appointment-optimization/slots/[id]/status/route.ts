import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import {
  isOpenSlotFilled,
  markOpenSlotFilled,
} from '@/lib/appointment-optimization/slotFilled'

/**
 * GET /api/appointment-optimization/slots/[id]/status
 * Re-check whether the slot has been filled (portal-driven booking).
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
    })
    if (!slot) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const filled = await isOpenSlotFilled(id)
    if (filled && slot.status === 'open') {
      await markOpenSlotFilled(id)
    }

    const updated = await prisma.openSlotEvent.findUnique({
      where: { id },
      include: {
        waves: { orderBy: { waveNumber: 'asc' } },
        _count: { select: { attempts: true } },
      },
    })

    return NextResponse.json({
      openSlotEventId: id,
      filled,
      slot: updated,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
