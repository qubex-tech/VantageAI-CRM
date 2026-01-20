import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { taskSchema } from '@/lib/validations'
import { emitEvent } from '@/lib/outbox'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const task = await prisma.task.findFirst({
      where: {
        id,
        practiceId,
        deletedAt: null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
            phone: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch task' },
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

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    // Get existing task
    const existing = await prisma.task.findFirst({
      where: {
        id,
        practiceId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const body = await req.json()
    const validated = taskSchema.partial().parse(body)

    // Handle status change to completed
    const updateData: any = { ...validated }
    if (validated.status === 'completed' && existing.status !== 'completed') {
      updateData.completedAt = new Date()
    } else if (validated.status !== 'completed' && existing.status === 'completed') {
      updateData.completedAt = null
    }

    // Validate patient exists if patientId is being updated
    if (updateData.patientId !== undefined && updateData.patientId !== null) {
      const patient = await prisma.patient.findFirst({
        where: {
          id: updateData.patientId,
          practiceId,
          deletedAt: null,
        },
      })

      if (!patient) {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        )
      }
    }

    // Validate assignee exists if assignedTo is being updated
    if (updateData.assignedTo !== undefined && updateData.assignedTo !== null) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: updateData.assignedTo,
          practiceId,
        },
      })

      if (!assignee) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 404 }
        )
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
            phone: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    // Emit event for task update
    await emitEvent({
      practiceId,
      eventName: 'task.updated',
      entityType: 'task',
      entityId: task.id,
      data: {
        task: {
          id: task.id,
          title: task.title,
          assignedTo: task.assignedTo,
          patientId: task.patientId,
          status: task.status,
          priority: task.priority,
        },
        changes: validated,
      },
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Error updating task:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
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
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const task = await prisma.task.findFirst({
      where: {
        id,
        practiceId,
        deletedAt: null,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    })

    // Emit event for task deletion
    await emitEvent({
      practiceId,
      eventName: 'task.deleted',
      entityType: 'task',
      entityId: task.id,
      data: {
        task: {
          id: task.id,
          title: task.title,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete task' },
      { status: 500 }
    )
  }
}
