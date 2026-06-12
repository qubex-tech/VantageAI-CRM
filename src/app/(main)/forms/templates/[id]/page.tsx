import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requirePracticeUser } from '@/lib/auth-server'
import { FormTemplateBuilder } from '@/components/forms/FormTemplateBuilder'
import { FormTemplateActions } from '@/components/forms/FormTemplateActions'

export const dynamic = 'force-dynamic'

export default async function FormTemplateDetailPage({ params }: { params: { id: string } }) {
    const user = await requirePracticeUser()


  const template = await prisma.formTemplate.findFirst({
    where: {
      id: params.id,
      practiceId: user.practiceId,
    },
  })

  if (!template) {
    redirect('/forms/templates')
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{template.name}</h1>
        <p className="text-sm text-gray-500">
          {template.isSystem ? 'System template (read-only)' : 'Update fields and details'}
        </p>
      </div>

      <div className="mb-6">
        <FormTemplateActions template={template as any} />
      </div>

      <FormTemplateBuilder template={template as any} />
    </div>
  )
}
