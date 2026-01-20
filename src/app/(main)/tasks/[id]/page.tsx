import { redirect, notFound } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { TaskForm } from '@/components/tasks/TaskForm'
import { TaskDetailView } from '@/components/tasks/TaskDetailView'

export const dynamic = 'force-dynamic'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabaseSession = await getSupabaseSession()
  
  if (!supabaseSession) {
    redirect('/login')
  }

  const supabaseUser = supabaseSession.user
  let user
  try {
    user = await syncSupabaseUserToPrisma(supabaseUser)
  } catch (error) {
    console.error('Error syncing user to Prisma:', error)
    redirect('/login')
  }
  
  if (!user || !user.practiceId) {
    redirect('/login')
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
    notFound()
  }

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

  return <TaskDetailView task={task} users={users} currentUserId={user.id} />
}
