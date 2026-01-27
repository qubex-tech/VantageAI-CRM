import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { seedDefaultFormTemplates } from '@/lib/form-templates'

export const dynamic = 'force-dynamic'

export default async function FormTemplatesPage() {
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

  const templates = await prisma.formTemplate.findMany({
    where: { practiceId: user.practiceId },
    orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }],
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Form Templates</h1>
          <p className="text-sm text-gray-500">Use templates to standardize patient forms</p>
        </div>
        <Link href="/forms/templates/new">
          <Button className="bg-gray-900 hover:bg-gray-800 text-white">Create template</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Templates</CardTitle>
          <CardDescription>System templates can be duplicated for customization</CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500 mb-4">No templates yet</p>
              <Link href="/forms/templates/new">
                <Button>Create your first template</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <Link key={template.id} href={`/forms/templates/${template.id}`}>
                  <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{template.name}</p>
                        <p className="text-sm text-gray-500">{template.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {template.category.replace('_', ' ')} • {template.status}
                        </p>
                      </div>
                      {template.isSystem && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          System
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
