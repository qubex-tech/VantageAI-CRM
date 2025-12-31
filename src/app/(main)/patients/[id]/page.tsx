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

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      practiceId: user.practiceId,
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
        take: 20,
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

  return <PatientDetailView patient={patient} />
}
