import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'

/**
 * GET /api/portal/tasks
 * Get patient tasks
 */
export async function GET(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    
    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    const tasks = await prisma.patientTask.findMany({
      where: {
        practiceId: practiceContext.practiceId,
        patientId,
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/portal/tasks/[id]
 * Update task status (e.g., mark as completed)
 */
export async function PATCH(req: NextRequest) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const body = await req.json()
    const { taskId, status } = body
    
    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    if (!taskId || !status) {
      return NextResponse.json(
        { error: 'Task ID and status required' },
        { status: 400 }
      )
    }

    // Verify task belongs to patient
    const task = await prisma.patientTask.findFirst({
      where: {
        id: taskId,
        practiceId: practiceContext.practiceId,
        patientId,
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Update task
    const updated = await prisma.patientTask.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : null,
      },
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        action: 'task_updated',
        resourceType: 'task',
        resourceId: taskId,
        changes: { status },
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ task: updated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    )
  }
}
