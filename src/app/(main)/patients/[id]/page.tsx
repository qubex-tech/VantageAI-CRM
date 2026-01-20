import { redirect, notFound } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { PatientDetailView } from '@/components/patients/PatientDetailView'

export const dynamic = 'force-dynamic'

export default async function PatientDetailPage({
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    const safeErrorMessage = errorMessage.length > 100 
      ? errorMessage.substring(0, 100) + '...'
      : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
  }
  
  if (!user) {
    redirect('/login?error=User account not found.')
  }

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    notFound()
  }
  const practiceId: string = user.practiceId as string

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      practiceId: practiceId,
      deletedAt: null,
    },
    include: {
      tags: true,
      insurancePolicies: true,
      appointments: {
        orderBy: { startTime: 'desc' },
      },
      timelineEntries: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })

  if (!patient) {
    return (
      <div className="container mx-auto p-4">
        <p>Patient not found</p>
      </div>
    )
  }

  // Get users for task assignment
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

  return <PatientDetailView patient={patient} users={users} currentUserId={user.id} />
}
