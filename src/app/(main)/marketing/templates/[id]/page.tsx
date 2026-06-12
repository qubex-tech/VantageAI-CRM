import { redirect, notFound } from 'next/navigation'
import { requirePracticeUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import TemplateEditor from '@/components/marketing/TemplateEditor'

export const dynamic = 'force-dynamic'

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
    const user = await requirePracticeUser()


  const template = await prisma.marketingTemplate.findFirst({
    where: {
      id,
      tenantId: user.practiceId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 10,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!template) {
    notFound()
  }

  // Get brand profile for preview
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { tenantId: user.practiceId },
  })

  return <TemplateEditor template={template as any} brandProfile={brandProfile} userId={user.id} />
}
