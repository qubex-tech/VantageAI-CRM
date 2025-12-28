import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PatientsList } from '@/components/patients/PatientsList'

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { search?: string }
}) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login')
  }

  const search = searchParams.search || ''

  const patients = await prisma.patient.findMany({
    where: {
      practiceId: session.user.practiceId,
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

