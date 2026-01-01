import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

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

    const workflow = await prisma.workflow.update({
      where: {
        id,
        practiceId: user.practiceId,
      },
      data: updateData,
    })

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

