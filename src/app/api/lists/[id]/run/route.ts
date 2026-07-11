import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { runListAutomations } from '@/lib/lists/run-list'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const { id } = await params
    const list = await prisma.patientList.findFirst({
      where: { id, practiceId: user.practiceId },
      select: { id: true },
    })
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const result = await runListAutomations({
      practiceId: user.practiceId,
      listId: id,
    })

    return NextResponse.json({ result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run list automations' },
      { status: 500 }
    )
  }
}
