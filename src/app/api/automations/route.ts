import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'

const automationRuleSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  triggerEvent: z.string().min(1),
  conditionsJson: z.any(), // JSON structure
  actionsJson: z.array(z.object({
    type: z.string(),
    args: z.record(z.any()),
  })),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const rules = await prisma.automationRule.findMany({
      where: {
        practiceId: user.practiceId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            runs: true,
          },
        },
      },
    })

    return NextResponse.json({ rules })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rules' },
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
    const validated = automationRuleSchema.parse(body)

    const rule = await prisma.automationRule.create({
      data: {
        practiceId: user.practiceId,
        name: validated.name,
        enabled: validated.enabled,
        triggerEvent: validated.triggerEvent,
        conditionsJson: validated.conditionsJson,
        actionsJson: validated.actionsJson,
        createdByUserId: user.id,
      },
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create rule' },
      { status: 500 }
    )
  }
}

