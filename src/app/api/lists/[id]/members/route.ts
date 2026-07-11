import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

export async function GET(
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

    const url = new URL(req.url)
    const take = Math.min(Number(url.searchParams.get('take') || 100), 500)
    const skip = Math.max(Number(url.searchParams.get('skip') || 0), 0)

    const [members, total] = await Promise.all([
      prisma.patientListMember.findMany({
        where: { listId: id, practiceId: user.practiceId },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              primaryPhone: true,
              dateOfBirth: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.patientListMember.count({
        where: { listId: id, practiceId: user.practiceId },
      }),
    ])

    return NextResponse.json({ members, total })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch members' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const deleted = await prisma.patientListMember.deleteMany({
      where: {
        listId: id,
        practiceId: user.practiceId,
      },
    })

    return NextResponse.json({
      success: true,
      removedCount: deleted.count,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear list members' },
      { status: 500 }
    )
  }
}
