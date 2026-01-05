import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    const queryPracticeId = searchParams.get('practiceId')

    // Normalize user object for type compatibility
    const normalizedUser = {
      ...user,
      name: user.name ?? null,
    }

    // If practiceId is provided in query and user is Vantage Admin, use it
    let practiceId: string | null = user.practiceId
    if (queryPracticeId && isVantageAdmin(normalizedUser)) {
      practiceId = queryPracticeId
    }

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const mapping = await prisma.calEventTypeMapping.findFirst({
      where: {
        id,
        practiceId: practiceId,
      },
    })

    if (!mapping) {
      return NextResponse.json({ error: 'Event type mapping not found' }, { status: 404 })
    }

    await prisma.calEventTypeMapping.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete event type mapping' },
      { status: 500 }
    )
  }
}

