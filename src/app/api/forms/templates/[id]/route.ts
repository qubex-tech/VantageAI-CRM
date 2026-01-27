import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)
    const templateId = context.params.id

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const template = await prisma.formTemplate.findFirst({
      where: {
        id: templateId,
        practiceId: user.practiceId,
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireAuth(req)
    const templateId = context.params.id

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { name, description, category, schema, status } = body

    const template = await prisma.formTemplate.update({
      where: { id: templateId },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        category: category ?? undefined,
        schema: schema ?? undefined,
        status: status ?? undefined,
      },
    })

    return NextResponse.json({ template })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update template' },
      { status: 500 }
    )
  }
}
