import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            runs: true,
          },
        },
      },
    })

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(workflow)
  } catch (error) {
    console.error('Error fetching workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch workflow' },
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
    const { id } = await params
    const body = await req.json()

    const { name, description, trigger, steps, isActive } = body

    // Get existing workflow to check if isActive is changing from false to true
    const existingWorkflow = await prisma.workflow.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
      },
      select: {
        isActive: true,
      },
    })

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Update workflow
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (trigger !== undefined) {
      updateData.triggerType = trigger?.type || null
      updateData.triggerConfig = trigger || null
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive
      // If publishing (changing from inactive to active), set publishedAt
      if (isActive && !existingWorkflow.isActive) {
        updateData.publishedAt = new Date()
      }
    }

    let workflow
    try {
      workflow = await prisma.workflow.update({
        where: {
          id,
          practiceId: user.practiceId,
        },
        data: updateData,
      })
    } catch (error: any) {
      // If error is about publishedAt, use raw SQL workaround
      if (error?.message?.includes('publishedAt') || error?.message?.includes('published_at')) {
        console.error('[Workflows API] Prisma Client sync issue - using raw SQL for update:', error.message)
        
        // Build SQL SET clauses using Prisma.Sql for safe SQL building
        const setParts: Prisma.Sql[] = []
        
        if (updateData.name !== undefined) {
          setParts.push(Prisma.sql`name = ${updateData.name}`)
        }
        if (updateData.description !== undefined) {
          setParts.push(Prisma.sql`description = ${updateData.description}`)
        }
        if (updateData.triggerType !== undefined) {
          setParts.push(Prisma.sql`"triggerType" = ${updateData.triggerType}`)
        }
        if (updateData.triggerConfig !== undefined) {
          setParts.push(Prisma.sql`"triggerConfig" = ${JSON.stringify(updateData.triggerConfig)}::jsonb`)
        }
        if (updateData.isActive !== undefined) {
          setParts.push(Prisma.sql`"isActive" = ${updateData.isActive}`)
        }
        if (updateData.publishedAt !== undefined) {
          setParts.push(Prisma.sql`"published_at" = ${updateData.publishedAt}`)
        }
        setParts.push(Prisma.sql`"updatedAt" = NOW()`)
        
        // Combine all SET clauses
        const setClause = Prisma.join(setParts, Prisma.sql`, `)
        
        // Execute update - use Prisma.join for the SET clause
        await prisma.$executeRaw(
          Prisma.sql`UPDATE workflows SET ${setClause} WHERE id = ${id} AND "practiceId" = ${user.practiceId}`
        )
        
        // Fetch updated workflow
        const updated = await prisma.$queryRaw<Array<{
          id: string
          practiceId: string
          name: string
          description: string | null
          isActive: boolean
          triggerType: string | null
          triggerConfig: any
          publishedAt: Date | null
          createdAt: Date
          updatedAt: Date
        }>>`
          SELECT 
            id, "practiceId", name, description, "isActive", "triggerType", "triggerConfig",
            "published_at" as "publishedAt", "createdAt", "updatedAt"
          FROM workflows
          WHERE id = ${id} AND "practiceId" = ${user.practiceId}
        `
        if (updated.length === 0) {
          throw new Error('Workflow not found')
        }
        workflow = updated[0] as any
      } else {
        throw error
      }
    }

    // Update steps if provided
    if (steps !== undefined) {
      // Delete existing steps
      await prisma.workflowStep.deleteMany({
        where: {
          workflowId: id,
        },
      })

      // Create new steps
      if (steps.length > 0) {
        await prisma.workflowStep.createMany({
          data: steps.map((step: any, index: number) => ({
            workflowId: id,
            type: step.type,
            order: index,
            config: step.config || {},
          })),
        })
      }
    }

    const updatedWorkflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json(updatedWorkflow)
  } catch (error) {
    console.error('Error updating workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update workflow' },
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

    await prisma.workflow.delete({
      where: {
        id,
        practiceId: user.practiceId,
      },
    })

    return NextResponse.json({ message: 'Workflow deleted' })
  } catch (error) {
    console.error('Error deleting workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete workflow' },
      { status: 500 }
    )
  }
}

