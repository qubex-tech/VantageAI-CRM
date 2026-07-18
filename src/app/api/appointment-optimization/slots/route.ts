import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { reconcileStaleOpenSlotsForPractice } from '@/lib/appointment-optimization/reconcileOpenSlots'

/**
 * GET /api/appointment-optimization/slots
 * Active open slots + outreach summary for admin dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
    }

    // Drop past Active rows (exhausted if unfilled, filled if occupied) before listing.
    await reconcileStaleOpenSlotsForPractice(user.practiceId)

    const status = req.nextUrl.searchParams.get('status') || 'open'
    const take = Math.min(Number(req.nextUrl.searchParams.get('take') || 50), 100)

    const now = new Date()
    const slots = await prisma.openSlotEvent.findMany({
      where: {
        practiceId: user.practiceId,
        ...(status === 'all'
          ? {}
          : status === 'open'
            ? // Active = still open and not yet started (past opens are reconciled above).
              { status: 'open', slotStart: { gt: now } }
            : { status }),
      },
      orderBy: { slotStart: 'asc' },
      take,
      include: {
        waves: { orderBy: { waveNumber: 'asc' } },
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            patient: { select: { id: true, name: true } },
          },
        },
      },
    })

    const stats = {
      open: await prisma.openSlotEvent.count({
        where: {
          practiceId: user.practiceId,
          status: 'open',
          slotStart: { gt: now },
        },
      }),
      filled: await prisma.openSlotEvent.count({
        where: { practiceId: user.practiceId, status: 'filled' },
      }),
      exhausted: await prisma.openSlotEvent.count({
        where: { practiceId: user.practiceId, status: 'exhausted' },
      }),
      totalAttempts: await prisma.outreachAttempt.count({
        where: { practiceId: user.practiceId },
      }),
    }

    return NextResponse.json({ slots, stats })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list slots' },
      { status: 500 }
    )
  }
}
