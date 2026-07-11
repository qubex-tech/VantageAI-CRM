import { notFound } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { ListDetailClient } from '@/components/lists/ListDetailClient'

export const dynamic = 'force-dynamic'

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuthenticatedUser()
  const { id } = await params

  if (!user.practiceId) {
    notFound()
  }

  const list = await prisma.patientList.findFirst({
    where: { id, practiceId: user.practiceId },
    select: {
      id: true,
      name: true,
      description: true,
      memberCount: true,
    },
  })

  if (!list) {
    notFound()
  }

  const [members, total] = await Promise.all([
    prisma.patientListMember.findMany({
      where: { listId: list.id, practiceId: user.practiceId },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            primaryPhone: true,
            dateOfBirth: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.patientListMember.count({
      where: { listId: list.id, practiceId: user.practiceId },
    }),
  ])

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
      <ListDetailClient list={list} initialMembers={members} initialTotal={total} />
    </div>
  )
}
