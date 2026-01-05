import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

/**
 * GET /api/patients/[id]/timeline
 * Get patient timeline events for Healix context
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    // Verify patient belongs to practice
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Get timeline entries
    const events = await prisma.patientTimelineEntry.findMany({
      where: {
        patientId: patientId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        createdAt: true,
        metadata: true,
      },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching timeline:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch timeline',
      },
      { status: 500 }
    )
  }
}

