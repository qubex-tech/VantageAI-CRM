import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { taskSchema } from '@/lib/validations'
import { emitEvent } from '@/lib/outbox'

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
    
    const searchParams = req.nextUrl.searchParams
    const assignedTo = searchParams.get('assignedTo') // 'me', 'unassigned', or user ID
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status') // 'pending', 'in_progress', 'completed', 'cancelled', 'on_hold'
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const dueDate = searchParams.get('dueDate') // 'today', 'overdue', 'upcoming', 'all'
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {
      practiceId,
      deletedAt: null,
    }

    // Filter by assignment
    if (assignedTo === 'me') {
      where.assignedTo = user.id
    } else if (assignedTo === 'unassigned') {
      where.assignedTo = null
    } else if (assignedTo) {
      where.assignedTo = assignedTo
    }

    // Filter by patient
    if (patientId) {
      where.patientId = patientId
    }

    // Filter by status
    if (status) {
      where.status = status
    }

    // Filter by priority
    if (priority) {
      where.priority = priority
    }

    // Filter by category
    if (category) {
      where.category = category
    }

    // Filter by due date
    if (dueDate === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      where.dueDate = {
        gte: today,
        lt: tomorrow,
      }
    } else if (dueDate === 'overdue') {
      const now = new Date()
      where.dueDate = {
        lt: now,
      }
      where.status = {
        not: 'completed',
      }
    } else if (dueDate === 'upcoming') {
      const now = new Date()
      where.dueDate = {
        gte: now,
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const tasks = await prisma.task.findMany({
      where,
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
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // urgent first
        { dueDate: 'asc' }, // earliest due first
        { createdAt: 'desc' }, // newest first
      ],
      take: limit,
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const body = await req.json()
    const validated = taskSchema.parse(body)

    // Validate patient exists if patientId is provided
    if (validated.patientId) {
      const patient = await prisma.patient.findFirst({
        where: {
          id: validated.patientId,
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

    // Validate assignee exists if assignedTo is provided
    if (validated.assignedTo) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: validated.assignedTo,
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

    const task = await prisma.task.create({
      data: {
        practiceId,
        createdBy: user.id,
        title: validated.title,
        description: validated.description,
        category: validated.category,
        priority: validated.priority,
        status: validated.status,
        dueDate: validated.dueDate,
        patientId: validated.patientId,
        appointmentId: validated.appointmentId,
        assignedTo: validated.assignedTo,
        isRecurring: validated.isRecurring,
        recurrenceRule: validated.recurrenceRule,
        metadata: validated.metadata,
        relatedTaskIds: validated.relatedTaskIds || [],
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
      },
    })

    // Emit event for task creation
    await emitEvent({
      practiceId,
      eventName: 'task.created',
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
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    )
  }
}
