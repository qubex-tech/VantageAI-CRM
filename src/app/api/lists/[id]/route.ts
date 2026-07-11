import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

const updateListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
})

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
      include: {
        imports: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    return NextResponse.json({ list })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch list' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.patientList.findFirst({
      where: { id, practiceId: user.practiceId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const body = await req.json()
    const validated = updateListSchema.parse(body)

    const list = await prisma.patientList.update({
      where: { id },
      data: {
        ...(validated.name !== undefined ? { name: validated.name.trim() } : {}),
        ...(validated.description !== undefined
          ? { description: validated.description?.trim() || null }
          : {}),
      },
    })

    return NextResponse.json({ list })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update list' },
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
    const existing = await prisma.patientList.findFirst({
      where: { id, practiceId: user.practiceId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    await prisma.patientList.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete list' },
      { status: 500 }
    )
  }
}
