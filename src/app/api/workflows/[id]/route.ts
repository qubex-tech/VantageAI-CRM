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
        
        // Build SET clauses and collect parameter values
        const setClauses: string[] = []
        const params: any[] = []
        let paramIndex = 1
        
        if (updateData.name !== undefined) {
          setClauses.push(`name = $${paramIndex}`)
          params.push(updateData.name)
          paramIndex++
        }
        if (updateData.description !== undefined) {
          setClauses.push(`description = $${paramIndex}`)
          params.push(updateData.description)
          paramIndex++
        }
        if (updateData.triggerType !== undefined) {
          setClauses.push(`"triggerType" = $${paramIndex}`)
          params.push(updateData.triggerType)
          paramIndex++
        }
        if (updateData.triggerConfig !== undefined) {
          setClauses.push(`"triggerConfig" = $${paramIndex}::jsonb`)
          params.push(JSON.stringify(updateData.triggerConfig))
          paramIndex++
        }
        if (updateData.isActive !== undefined) {
          setClauses.push(`"isActive" = $${paramIndex}`)
          params.push(updateData.isActive)
          paramIndex++
        }
        if (updateData.publishedAt !== undefined) {
          setClauses.push(`"published_at" = $${paramIndex}`)
          params.push(updateData.publishedAt)
          paramIndex++
        }
        setClauses.push(`"updatedAt" = NOW()`)
        
        // Execute update using parameterized query
        const sql = `UPDATE workflows SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND "practiceId" = $${paramIndex + 1}`
        params.push(id, user.practiceId)
        
        await prisma.$executeRawUnsafe(sql, ...params)
        
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

