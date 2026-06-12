import { redirect } from 'next/navigation'
import { requirePracticeUser } from '@/lib/auth-server'
import { FormTemplateBuilder } from '@/components/forms/FormTemplateBuilder'

export const dynamic = 'force-dynamic'

export default async function NewFormTemplatePage() {
    const user = await requirePracticeUser()


  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create Form Template</h1>
        <p className="text-sm text-gray-500">Design a reusable form for patients</p>
      </div>

      <FormTemplateBuilder />
    </div>
  )
}
