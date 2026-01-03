import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

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
    
    const workflows = await prisma.workflow.findMany({
      where: {
        practiceId: practiceId,
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

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

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

      // Update workflow - use raw SQL if Prisma Client is out of sync
      let workflow
      try {
        workflow = await prisma.workflow.update({
          where: {
            id: workflowId,
            practiceId: practiceId,
          },
          data: {
            name,
            description: description || null,
            triggerType: trigger?.type || null,
            triggerConfig: trigger || null,
            isActive: false, // Reset to inactive when saving draft
          },
        })
      } catch (error: any) {
        // If error is about publishedAt, use raw SQL workaround
        if (error?.message?.includes('publishedAt') || error?.message?.includes('published_at')) {
          console.error('[Workflows API] Prisma Client sync issue - using raw SQL for update:', error.message)
          
          // Build SET clauses and collect parameter values
          const setClauses: string[] = []
          const params: any[] = []
          let paramIndex = 1
          
          if (name !== undefined) {
            setClauses.push(`name = $${paramIndex}`)
            params.push(name)
            paramIndex++
          }
          if (description !== undefined) {
            setClauses.push(`description = $${paramIndex}`)
            params.push(description !== null ? description : null)
            paramIndex++
          }
          if (trigger?.type !== undefined) {
            setClauses.push(`"triggerType" = $${paramIndex}`)
            params.push(trigger?.type || null)
            paramIndex++
          }
          if (trigger !== undefined) {
            setClauses.push(`"triggerConfig" = $${paramIndex}::jsonb`)
            params.push(JSON.stringify(trigger || null))
            paramIndex++
          }
          setClauses.push(`"isActive" = $${paramIndex}`)
          params.push(false)
          paramIndex++
          setClauses.push(`"updatedAt" = NOW()`)
          
          // Execute update using parameterized query
          const sql = `UPDATE workflows SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND "practiceId" = $${paramIndex + 1}`
          params.push(workflowId, practiceId)
          
          await prisma.$executeRawUnsafe(sql, ...params)
          
          // Fetch updated workflow using raw SQL (since Prisma Client is out of sync)
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
            WHERE id = ${workflowId} AND "practiceId" = ${practiceId}
          `
          if (updated.length === 0) {
            throw new Error('Workflow not found')
          }
          workflow = updated[0] as any
        } else {
          throw error
        }
      }

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

      // Fetch updated workflow - use raw SQL if Prisma Client is out of sync
      let updatedWorkflow
      try {
        updatedWorkflow = await prisma.workflow.findUnique({
          where: { id: workflow.id },
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        })
      } catch (error: any) {
        // If error is about publishedAt, use raw SQL workaround
        if (error?.message?.includes('publishedAt') || error?.message?.includes('published_at')) {
          console.error('[Workflows API] Prisma Client sync issue - using raw SQL for findUnique:', error.message)
          
          // Fetch workflow using raw SQL
          const workflowData = await prisma.$queryRaw<Array<{
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
            WHERE id = ${workflow.id} AND "practiceId" = ${practiceId}
          `
          
          if (workflowData.length === 0) {
            throw new Error('Workflow not found')
          }
          
          // Fetch steps separately
          const stepsData = await prisma.workflowStep.findMany({
            where: { workflowId: workflow.id },
            orderBy: { order: 'asc' },
          })
          
          // Reconstruct workflow object
          updatedWorkflow = {
            ...workflowData[0],
            steps: stepsData,
          } as any
        } else {
          throw error
        }
      }

      return NextResponse.json(updatedWorkflow)
    } else {
      // Create new workflow
      let workflow
      try {
        workflow = await prisma.workflow.create({
          data: {
            practiceId: practiceId,
            name,
            description: description || null,
            triggerType: trigger?.type || null,
            triggerConfig: trigger || null,
            isActive: false,
          },
        })
      } catch (error: any) {
        // If error is about publishedAt, use raw SQL workaround
        if (error?.message?.includes('publishedAt') || error?.message?.includes('published_at')) {
          console.error('[Workflows API] Prisma Client sync issue - using raw SQL for create:', error.message)
          
          // Use raw SQL to create workflow
          const result = await prisma.$queryRaw<Array<{ id: string }>>`
            INSERT INTO workflows (
              id, "practiceId", name, description, "isActive", "triggerType", "triggerConfig",
              "createdAt", "updatedAt"
            )
            VALUES (
              gen_random_uuid()::text, ${practiceId}, ${name}, ${description || null},
              false, ${trigger?.type || null}, ${JSON.stringify(trigger || null)}::jsonb,
              NOW(), NOW()
            )
            RETURNING id
          `
          
          if (result.length === 0) {
            throw new Error('Failed to create workflow')
          }
          
          // Fetch the created workflow using raw SQL
          const created = await prisma.$queryRaw<Array<{
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
            WHERE id = ${result[0].id}
          `
          
          if (created.length === 0) {
            throw new Error('Failed to retrieve created workflow')
          }
          
          workflow = {
            id: created[0].id,
            practiceId: created[0].practiceId,
            name: created[0].name,
            description: created[0].description,
            isActive: created[0].isActive,
            triggerType: created[0].triggerType,
            triggerConfig: created[0].triggerConfig,
            publishedAt: created[0].publishedAt,
            createdAt: created[0].createdAt,
            updatedAt: created[0].updatedAt,
          } as any
        } else {
          throw error
        }
      }

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

      // Fetch created workflow with steps - use raw SQL if Prisma Client is out of sync
      let createdWorkflow
      try {
        createdWorkflow = await prisma.workflow.findUnique({
          where: { id: workflow.id },
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        })
      } catch (error: any) {
        // If error is about publishedAt, use raw SQL workaround
        if (error?.message?.includes('publishedAt') || error?.message?.includes('published_at')) {
          console.error('[Workflows API] Prisma Client sync issue - using raw SQL for findUnique:', error.message)
          
          // Fetch workflow using raw SQL
          const workflowData = await prisma.$queryRaw<Array<{
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
            WHERE id = ${workflow.id} AND "practiceId" = ${practiceId}
          `
          
          if (workflowData.length === 0) {
            return NextResponse.json(
              { error: 'Workflow created but could not be retrieved' },
              { status: 500 }
            )
          }
          
          // Fetch steps separately
          const stepsData = await prisma.workflowStep.findMany({
            where: { workflowId: workflow.id },
            orderBy: { order: 'asc' },
          })
          
          // Reconstruct workflow object
          createdWorkflow = {
            ...workflowData[0],
            steps: stepsData,
          } as any
        } else {
          throw error
        }
      }

      if (!createdWorkflow) {
        return NextResponse.json(
          { error: 'Workflow created but could not be retrieved' },
          { status: 500 }
        )
      }

      // Log workflow creation in audit log
      await createAuditLog({
        practiceId: practiceId,
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

