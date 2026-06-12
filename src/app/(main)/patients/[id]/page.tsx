import { redirect, notFound } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { PatientDetailView } from '@/components/patients/PatientDetailView'

export const dynamic = 'force-dynamic'

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAuthenticatedUser()

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
      insurancePolicies: {
        orderBy: [{ isPrimary: 'desc' }],
      },
      appointments: {
        orderBy: { startTime: 'desc' },
      },
      timelineEntries: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      formSubmissions: {
        orderBy: { submittedAt: 'desc' },
        take: 50,
        include: {
          template: true,
          request: true,
        },
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
