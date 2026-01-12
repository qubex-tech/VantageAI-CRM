import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'

/**
 * GET /api/portal/threads
 * Get conversation threads for current patient
 */
export async function GET(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    
    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    const threads = await prisma.conversationThread.findMany({
      where: {
        practiceId: practiceContext.practiceId,
        patientId,
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    })

    return NextResponse.json({ threads })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch threads' },
      { status: 500 }
    )
  }
}
