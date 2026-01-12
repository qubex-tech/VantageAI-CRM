import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePatientSession } from '@/lib/portal-session'

/**
 * GET /api/portal/timeline
 * Get unified patient activity timeline
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientSession(req)
    const { patientId, practiceId } = session

    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get appointments
    const appointments = await prisma.appointment.findMany({
      where: {
        practiceId,
        patientId,
      },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        visitType: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset,
    })

    // Get messages
    const messages = await prisma.portalMessage.findMany({
      where: {
        practiceId,
        patientId,
      },
      select: {
        id: true,
        channel: true,
        direction: true,
        subject: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Get tasks
    const tasks = await prisma.patientTask.findMany({
      where: {
        practiceId,
        patientId,
      },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Get consent changes
    const consentRecords = await prisma.consentRecord.findMany({
      where: {
        practiceId,
        patientId,
      },
      select: {
        id: true,
        consentType: true,
        consented: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Get feedback
    const feedbacks = await prisma.feedback.findMany({
      where: {
        practiceId,
        patientId,
      },
      select: {
        id: true,
        type: true,
        score: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Combine and sort all events by date
    const events = [
      ...appointments.map(a => ({
        type: 'appointment' as const,
        id: a.id,
        timestamp: a.updatedAt,
        data: a,
      })),
      ...messages.map(m => ({
        type: 'message' as const,
        id: m.id,
        timestamp: m.createdAt,
        data: m,
      })),
      ...tasks.map(t => ({
        type: 'task' as const,
        id: t.id,
        timestamp: t.updatedAt,
        data: t,
      })),
      ...consentRecords.map(c => ({
        type: 'consent' as const,
        id: c.id,
        timestamp: c.createdAt,
        data: c,
      })),
      ...feedbacks.map(f => ({
        type: 'feedback' as const,
        id: f.id,
        timestamp: f.createdAt,
        data: f,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)

    return NextResponse.json({ events })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch timeline' },
      { status: 500 }
    )
  }
}
