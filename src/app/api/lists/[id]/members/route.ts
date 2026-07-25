import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { addPatientToList } from '@/lib/lists/add-member'
import { removePatientsFromList } from '@/lib/lists/remove-members'

const addMemberSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
})

const removeMembersSchema = z.object({
  patientIds: z.array(z.string().min(1)).min(1, 'At least one patientId is required'),
})

export async function POST(
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
    const body = await req.json()
    const parsed = addMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    const result = await addPatientToList({
      practiceId,
      listId: id,
      patientId: parsed.data.patientId,
      source: 'manual',
    })

    return NextResponse.json(
      {
        status: result.status,
        member: result.member,
        list: result.list,
      },
      { status: result.status === 'added' ? 201 : 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add member'
    const status =
      message === 'List not found' || message === 'Patient not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

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

    // Optional body: { patientIds: [...] } removes those members.
    // No body / empty body clears the entire list (legacy Clear List behavior).
    const rawBody = await req.text()
    if (rawBody.trim()) {
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(rawBody)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const parsed = removeMembersSchema.safeParse(parsedJson)
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid request' },
          { status: 400 }
        )
      }

      const result = await removePatientsFromList({
        practiceId,
        listId: id,
        patientIds: parsed.data.patientIds,
      })

      return NextResponse.json({
        success: true,
        ...result,
      })
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
    const message = error instanceof Error ? error.message : 'Failed to clear list members'
    const status = message === 'List not found' ? 404 : message.includes('patientId') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
