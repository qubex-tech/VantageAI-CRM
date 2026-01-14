import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'
import { createMarketingAuditLog } from '@/lib/marketing/audit'

export const dynamic = 'force-dynamic'

const updateContentBlockSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  blockData: z.any().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isGlobal: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const block = await prisma.marketingContentBlock.findFirst({
      where: {
        id,
        tenantId: user.practiceId,
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

    if (!block) {
      return NextResponse.json(
        { error: 'Content block not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ block })
  } catch (error: any) {
    console.error('Error fetching content block:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content block' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = updateContentBlockSchema.parse(body)

    const block = await prisma.marketingContentBlock.findFirst({
      where: {
        id,
        tenantId: user.practiceId,
      },
    })

    if (!block) {
      return NextResponse.json(
        { error: 'Content block not found' },
        { status: 404 }
      )
    }

    const updated = await prisma.marketingContentBlock.update({
      where: { id },
      data: validated,
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

    // If this is a global block, update usage count
    if (block.isGlobal && validated.blockData) {
      // TODO: Propagate updates to all templates using this block
      // This would require tracking which templates use which blocks
    }

    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'TEMPLATE_UPDATED', // Using existing action type
      entityType: 'ContentBlock',
      entityId: id,
      metadata: { updatedFields: Object.keys(validated) },
    })

    return NextResponse.json({ block: updated })
  } catch (error: any) {
    console.error('Error updating content block:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update content block' },
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
    const { id } = await params
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const block = await prisma.marketingContentBlock.findFirst({
      where: {
        id,
        tenantId: user.practiceId,
      },
    })

    if (!block) {
      return NextResponse.json(
        { error: 'Content block not found' },
        { status: 404 }
      )
    }

    await prisma.marketingContentBlock.delete({
      where: { id },
    })

    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'TEMPLATE_ARCHIVED', // Using existing action type
      entityType: 'ContentBlock',
      entityId: id,
      metadata: { name: block.name },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting content block:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete content block' },
      { status: 500 }
    )
  }
}
