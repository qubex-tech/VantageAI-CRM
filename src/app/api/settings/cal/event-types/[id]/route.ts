import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)

    const mapping = await prisma.calEventTypeMapping.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
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

