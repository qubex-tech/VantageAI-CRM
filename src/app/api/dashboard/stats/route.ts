import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { startOfDay, endOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const practiceId = user.practiceId
    const now = new Date()

    const [totalPatients, todayAppointments, pendingTasks, openConversations] = await Promise.all([
      prisma.patient.count({
        where: { practiceId, deletedAt: null },
      }),
      prisma.appointment.count({
        where: {
          practiceId,
          startTime: {
            gte: startOfDay(now),
            lte: endOfDay(now),
          },
        },
      }),
      prisma.task.count({
        where: {
          practiceId,
          status: 'pending',
          deletedAt: null,
        },
      }),
      prisma.conversation.count({
        where: {
          practiceId,
          status: 'open',
        },
      }),
    ])

    return NextResponse.json({
      totalPatients,
      todayAppointments,
      pendingTasks,
      openConversations,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
