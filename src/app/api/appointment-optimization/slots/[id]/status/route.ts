import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import {
  isOpenSlotFilled,
  markOpenSlotFilled,
} from '@/lib/appointment-optimization/slotFilled'
import { OPEN_SLOT_STATUS } from '@/lib/appointment-optimization/types'

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

    const occupied = await isOpenSlotFilled(id)
    if (occupied && slot.status === OPEN_SLOT_STATUS.OPEN) {
      await markOpenSlotFilled(id)
    } else if (
      !occupied &&
      (slot.status === OPEN_SLOT_STATUS.FILLED ||
        slot.status === OPEN_SLOT_STATUS.EXHAUSTED)
    ) {
      await prisma.openSlotEvent.update({
        where: { id },
        data: { status: OPEN_SLOT_STATUS.OPEN, filledAt: null },
      })
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
      filled: occupied,
      slot: updated,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
