import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { requirePatientSession } from '@/lib/portal-session'

/**
 * GET /api/portal/me
 * Get current patient information
 * Requires: practice context (from subdomain) + patient session
 */
export async function GET(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const session = await requirePatientSession(req)
    const { patientId } = session

    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
        practiceId: practiceContext.practiceId,
      },
      include: {
        patientAccount: true,
        communicationPreferences: true,
        appointments: {
          take: 5,
          orderBy: { startTime: 'desc' },
        },
        portalTasks: {
          take: 5,
          where: { status: { in: ['pending', 'in_progress'] } },
          orderBy: { dueDate: 'asc' },
        },
        conversationThreads: {
          take: 3,
          orderBy: { lastMessageAt: 'desc' },
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ patient })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch patient' },
      { status: 500 }
    )
  }
}
