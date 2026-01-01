import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    const workflows = await prisma.workflow.findMany({
      where: {
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
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json(workflows)
  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { name, description, trigger, steps, workflowId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Workflow name is required' },
        { status: 400 }
      )
    }

    // If workflowId is provided, update existing workflow
    if (workflowId) {
      // First, delete existing steps
      await prisma.workflowStep.deleteMany({
        where: {
          workflowId: workflowId,
        },
      })

      // Update workflow
      const workflow = await prisma.workflow.update({
        where: {
          id: workflowId,
          practiceId: user.practiceId,
        },
        data: {
          name,
          description: description || null,
          triggerType: trigger?.type || null,
          triggerConfig: trigger || null,
          isActive: false, // Reset to inactive when saving draft
        },
      })

      // Create new steps
      if (steps && steps.length > 0) {
        await prisma.workflowStep.createMany({
          data: steps.map((step: any, index: number) => ({
            workflowId: workflow.id,
            type: step.type,
            order: index,
            config: step.config || {},
          })),
        })
      }

      const updatedWorkflow = await prisma.workflow.findUnique({
        where: { id: workflow.id },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      })

      return NextResponse.json(updatedWorkflow)
    } else {
      // Create new workflow
      const workflow = await prisma.workflow.create({
        data: {
          practiceId: user.practiceId,
          name,
          description: description || null,
          triggerType: trigger?.type || null,
          triggerConfig: trigger || null,
          isActive: false,
        },
      })

      // Create steps
      if (steps && steps.length > 0) {
        await prisma.workflowStep.createMany({
          data: steps.map((step: any, index: number) => ({
            workflowId: workflow.id,
            type: step.type,
            order: index,
            config: step.config || {},
          })),
        })
      }

      const createdWorkflow = await prisma.workflow.findUnique({
        where: { id: workflow.id },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!createdWorkflow) {
        return NextResponse.json(
          { error: 'Workflow created but could not be retrieved' },
          { status: 500 }
        )
      }

      // Log workflow creation in audit log
      await createAuditLog({
        practiceId: user.practiceId,
        userId: user.id,
        action: 'create',
        resourceType: 'workflow',
        resourceId: createdWorkflow.id,
        changes: { after: { name: createdWorkflow.name } },
      })

      return NextResponse.json(createdWorkflow, { status: 201 })
    }
  } catch (error) {
    console.error('Error saving workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save workflow' },
      { status: 500 }
    )
  }
}

