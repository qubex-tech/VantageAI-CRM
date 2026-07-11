import { requireAuthenticatedUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { PageIntro } from '@/components/layout/PageIntro'
import { ListsPageClient } from '@/components/lists/ListsPageClient'

export const dynamic = 'force-dynamic'

export default async function ListsPage() {
  const user = await requireAuthenticatedUser()

  if (!user.practiceId) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
        <PageIntro description="Patient lists" />
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">No lists available.</p>
        </div>
      </div>
    )
  }

  const lists = await prisma.patientList.findMany({
    where: { practiceId: user.practiceId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      memberCount: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
      <PageIntro description="Patient lists for outreach and automations" />
      <ListsPageClient initialLists={lists} />
    </div>
  )
}
