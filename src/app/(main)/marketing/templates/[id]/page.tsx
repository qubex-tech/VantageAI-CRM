import { redirect, notFound } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import TemplateEditor from '@/components/marketing/TemplateEditor'

export const dynamic = 'force-dynamic'

export default async function TemplateDetailPage({
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
    redirect('/login')
  }
  
  if (!user || !user.practiceId) {
    notFound()
  }

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
