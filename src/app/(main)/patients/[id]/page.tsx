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
  const practiceId = user.practiceId

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
    // Select all fields including new enhanced fields
    select: undefined, // This ensures all fields are included
  })

  if (!patient) {
    return (
      <div className="container mx-auto p-4">
        <p>Patient not found</p>
      </div>
    )
  }

  // Debug: Log appointments count
  console.log('[PatientDetailPage] Patient appointments count:', patient.appointments?.length || 0)
  console.log('[PatientDetailPage] Patient ID:', patient.id)
  console.log('[PatientDetailPage] Practice ID:', practiceId)
  
  // Also verify appointments exist for this patient directly
  const directAppointmentCount = await prisma.appointment.count({
    where: {
      patientId: patient.id,
      practiceId: practiceId,
    },
  })
  console.log('[PatientDetailPage] Direct appointment count query:', directAppointmentCount)

  return <PatientDetailView patient={patient} />
}
