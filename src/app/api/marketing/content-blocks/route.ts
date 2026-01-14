import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'
import { createMarketingAuditLog } from '@/lib/marketing/audit'

export const dynamic = 'force-dynamic'

const createContentBlockSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  blockData: z.any(), // Block or Row structure
  blockType: z.enum(['block', 'row']),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isGlobal: z.boolean().optional().default(false),
})

const updateContentBlockSchema = createContentBlockSchema.partial()

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const isGlobal = searchParams.get('isGlobal') === 'true'

    const where: any = {
      tenantId: user.practiceId,
    }

    if (category) {
      where.category = category
    }

    if (isGlobal !== null) {
      where.isGlobal = isGlobal
    }

    const blocks = await prisma.marketingContentBlock.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ blocks })
  } catch (error: any) {
    console.error('Error fetching content blocks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content blocks' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = createContentBlockSchema.parse(body)

    const block = await prisma.marketingContentBlock.create({
      data: {
        tenantId: user.practiceId,
        createdByUserId: user.id,
        ...validated,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'TEMPLATE_CREATED',
      entityType: 'ContentBlock',
      entityId: block.id,
      metadata: { name: block.name, blockType: block.blockType },
    })

    return NextResponse.json({ block })
  } catch (error: any) {
    console.error('Error creating content block:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create content block' },
      { status: 500 }
    )
  }
}
