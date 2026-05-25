import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

/**
 * GET /api/appointment-optimization/outreach
 * Outreach attempt history (optional filters).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
    }

    const openSlotEventId = req.nextUrl.searchParams.get('openSlotEventId')
    const attempts = await prisma.outreachAttempt.findMany({
      where: {
        practiceId: user.practiceId,
        ...(openSlotEventId ? { openSlotEventId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        patient: { select: { id: true, name: true, phone: true, primaryPhone: true } },
        openSlotEvent: {
          select: { slotStart: true, slotEnd: true, appointmentType: true, status: true },
        },
      },
    })

    return NextResponse.json({ attempts })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list outreach' },
      { status: 500 }
    )
  }
}
