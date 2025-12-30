import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { ScheduleAppointmentForm } from '@/components/appointments/ScheduleAppointmentForm'

export const dynamic = 'force-dynamic'

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>
}) {
  const params = await searchParams
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

  // Require patientId
  if (!params.patientId) {
    redirect('/patients')
  }

  // Fetch patient
  const patient = await prisma.patient.findFirst({
    where: {
      id: params.patientId,
      practiceId: user.practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    redirect('/patients')
  }

  // Fetch event type mappings
  const eventTypeMappings = await prisma.calEventTypeMapping.findMany({
    where: {
      practiceId: user.practiceId,
    },
    orderBy: {
      visitTypeName: 'asc',
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Schedule Appointment</h1>
        <p className="text-sm text-gray-500">Book a new appointment</p>
      </div>
      <ScheduleAppointmentForm
        patientId={patient.id}
        patient={{
          id: patient.id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
        }}
        eventTypeMappings={eventTypeMappings.map(m => ({
          id: m.id,
          visitTypeName: m.visitTypeName,
          calEventTypeId: m.calEventTypeId,
        }))}
      />
    </div>
  )
}

