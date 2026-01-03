import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PatientsList } from '@/components/patients/PatientsList'

export const dynamic = 'force-dynamic'

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
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

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    // Return empty patients list for users without practiceId
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Patients</h1>
          <p className="text-sm text-gray-500">Patient directory</p>
        </div>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">No patients available.</p>
        </div>
      </div>
    )
  }
  const practiceId = user.practiceId

  const search = params.search || ''

  const patients = await prisma.patient.findMany({
    where: {
      practiceId: practiceId,
      deletedAt: null,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ]
        : undefined,
    },
    include: {
      _count: {
        select: {
          appointments: true,
          insurancePolicies: true,
        },
      },
      appointments: {
        select: {
          id: true,
          startTime: true,
          status: true,
        },
        orderBy: {
          startTime: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Patients</h1>
          <p className="text-sm text-gray-500">Manage your patients</p>
        </div>
        <Link href="/patients/new">
          <Button className="bg-gray-900 hover:bg-gray-800 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" />
            Add Patient
          </Button>
        </Link>
      </div>

      <PatientsList initialPatients={patients} />
    </div>
  )
}

