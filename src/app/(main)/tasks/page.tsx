import { redirect } from 'next/navigation'
import { requirePracticeUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { TasksList } from '@/components/tasks/TasksList'
import { PageIntro } from '@/components/layout/PageIntro'

export const dynamic = 'force-dynamic'

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    assignedTo?: string
    patientId?: string
    status?: string
    priority?: string
    category?: string
    dueDate?: string
    search?: string
  }>
}) {
  const params = await searchParams
  const user = await requirePracticeUser()

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
        <PageIntro description="Task management" />
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">No tasks available.</p>
        </div>
      </div>
    )
  }
  const practiceId: string = user.practiceId as string

  // Build where clause for Prisma query
  const where: any = {
    practiceId,
    deletedAt: null,
  }

  // Filter by assignment
  if (params.assignedTo === 'me') {
    where.assignedTo = user.id
  } else if (params.assignedTo === 'unassigned') {
    where.assignedTo = null
  } else if (params.assignedTo) {
    where.assignedTo = params.assignedTo
  }

  // Filter by patient
  if (params.patientId) {
    where.patientId = params.patientId
  }

  // Filter by status
  if (params.status) {
    where.status = params.status
  }

  // Filter by priority
  if (params.priority) {
    where.priority = params.priority
  }

  // Filter by category
  if (params.category) {
    where.category = params.category
  }

  // Filter by due date
  if (params.dueDate === 'today') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    where.dueDate = {
      gte: today,
      lt: tomorrow,
    }
  } else if (params.dueDate === 'overdue') {
    const now = new Date()
    where.dueDate = {
      lt: now,
    }
    where.status = {
      not: 'completed',
    }
  } else if (params.dueDate === 'upcoming') {
    const now = new Date()
    where.dueDate = {
      gte: now,
    }
  }

  // Search filter
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' as const } },
      { description: { contains: params.search, mode: 'insensitive' as const } },
    ]
  }

  // Fetch tasks
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
      { priority: 'desc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 100,
  })

  // Get users for assignment dropdown
  const users = await prisma.user.findMany({
    where: {
      practiceId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Get patients for record linking
  const patients = await prisma.patient.findMany({
    where: {
      practiceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryPhone: true,
      phone: true,
    },
    take: 100, // Limit for performance
    orderBy: {
      name: 'asc',
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
      <TasksList 
        initialTasks={tasks} 
        currentUserId={user.id} 
        users={users}
        patients={patients}
      />
    </div>
  )
}
