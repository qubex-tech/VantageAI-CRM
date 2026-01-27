import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { seedDefaultFormTemplates } from '@/lib/form-templates'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const practiceId = user.practiceId

    await seedDefaultFormTemplates(practiceId, user.id)

    const templates = await prisma.formTemplate.findMany({
      where: { practiceId },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json({ templates })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { name, description, category, schema } = body

    if (!name || !schema) {
      return NextResponse.json(
        { error: 'Name and schema are required' },
        { status: 400 }
      )
    }

    const template = await prisma.formTemplate.create({
      data: {
        practiceId: user.practiceId,
        name,
        description: description || null,
        category: category || 'custom',
        status: 'published',
        schema,
        isSystem: false,
        createdByUserId: user.id,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create template' },
      { status: 500 }
    )
  }
}
