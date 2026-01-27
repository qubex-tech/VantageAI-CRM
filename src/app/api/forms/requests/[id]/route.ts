import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)
    const requestId = context.params.id

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const request = await prisma.formRequest.findFirst({
      where: {
        id: requestId,
        practiceId: user.practiceId,
      },
      include: {
        patient: true,
        template: true,
        submission: true,
      },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ request })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch request' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)
    const requestId = context.params.id

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { status } = body

    const request = await prisma.formRequest.update({
      where: { id: requestId },
      data: {
        status: status ?? undefined,
        completedAt: status === 'submitted' ? new Date() : undefined,
      },
    })

    return NextResponse.json({ request })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update request' },
      { status: 500 }
    )
  }
}
