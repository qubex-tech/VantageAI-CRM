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
    const practiceId = user.practiceId

    const { id } = await params
    const list = await prisma.patientList.findFirst({
      where: { id, practiceId },
      select: { id: true, name: true },
    })
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const url = new URL(req.url)
    const take = Math.min(Number(url.searchParams.get('take') || 100), 500)
    const skip = Math.max(Number(url.searchParams.get('skip') || 0), 0)

    const [members, total] = await Promise.all([
      prisma.patientListMember.findMany({
        where: { listId: id, practiceId },
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
        where: { listId: id, practiceId },
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
    const practiceId = user.practiceId

    const { id } = await params
    const list = await prisma.patientList.findFirst({
      where: { id, practiceId },
      select: { id: true, name: true },
    })
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const { removedCount, remainingCount, removedTagCount } = await prisma.$transaction(async (tx) => {
      const membersBeforeClear = await tx.patientListMember.findMany({
        where: {
          listId: id,
          practiceId,
        },
        select: { patientId: true },
        distinct: ['patientId'],
      })
      const affectedPatientIds = membersBeforeClear.map((m) => m.patientId)

      const deleted = await tx.patientListMember.deleteMany({
        where: {
          listId: id,
          practiceId,
        },
      })

      const remaining = await tx.patientListMember.count({
        where: {
          listId: id,
          practiceId,
        },
      })

      await tx.patientList.update({
        where: { id },
        data: { memberCount: remaining },
      })

      let removedTags = 0
      if (affectedPatientIds.length > 0) {
        const patientsStillOnSameNamedList = await tx.patientListMember.findMany({
          where: {
            practiceId,
            patientId: { in: affectedPatientIds },
            list: { name: list.name },
          },
          select: { patientId: true },
          distinct: ['patientId'],
        })
        const keepTagPatientIds = new Set(patientsStillOnSameNamedList.map((p) => p.patientId))
        const removeTagPatientIds = affectedPatientIds.filter((patientId) => !keepTagPatientIds.has(patientId))
        if (removeTagPatientIds.length > 0) {
          const tagDeleteResult = await tx.patientTag.deleteMany({
            where: {
              patientId: { in: removeTagPatientIds },
              tag: list.name,
            },
          })
          removedTags = tagDeleteResult.count
        }
      }

      return {
        removedCount: deleted.count,
        remainingCount: remaining,
        removedTagCount: removedTags,
      }
    })

    return NextResponse.json({
      success: true,
      removedCount,
      remainingCount,
      removedTagCount,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear list members' },
      { status: 500 }
    )
  }
}
