import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { FormRequestForm } from '@/components/forms/FormRequestForm'
import { seedDefaultFormTemplates } from '@/lib/form-templates'

export const dynamic = 'force-dynamic'

export default async function NewFormRequestPage() {
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
    redirect('/login')
  }

  await seedDefaultFormTemplates(user.practiceId, user.id)

  const [templates, patients, emailTemplates, smsTemplates] = await Promise.all([
    prisma.formTemplate.findMany({
      where: { practiceId: user.practiceId },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true, name: true, category: true },
    }),
    prisma.patient.findMany({
      where: { practiceId: user.practiceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
      take: 200,
    }),
    prisma.marketingTemplate.findMany({
      where: {
        tenantId: user.practiceId,
        channel: 'email',
        status: 'published',
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, category: true },
    }),
    prisma.marketingTemplate.findMany({
      where: {
        tenantId: user.practiceId,
        channel: 'sms',
        status: 'published',
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, category: true },
    }),
  ])

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Send a Form</h1>
        <p className="text-sm text-gray-500">Select a patient and choose a form template</p>
      </div>

      <FormRequestForm
        templates={templates}
        emailTemplates={emailTemplates}
        smsTemplates={smsTemplates}
        patients={patients}
      />
    </div>
  )
}
