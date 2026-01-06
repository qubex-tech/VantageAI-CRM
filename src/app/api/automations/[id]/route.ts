import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  triggerEvent: z.string().min(1).optional(),
  conditionsJson: z.any().optional(),
  actionsJson: z.array(z.object({
    type: z.string(),
    args: z.record(z.any()),
  })).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const existing = await prisma.automationRule.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const validated = updateRuleSchema.parse(body)

    const rule = await prisma.automationRule.update({
      where: { id },
      data: validated,
    })

    return NextResponse.json({ rule })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update rule' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const existing = await prisma.automationRule.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    await prisma.automationRule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete rule' },
      { status: 500 }
    )
  }
}

