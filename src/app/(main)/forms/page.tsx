import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { seedDefaultFormTemplates } from '@/lib/form-templates'

export const dynamic = 'force-dynamic'

export default async function FormsPage() {
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

  const practiceId = user.practiceId

  await seedDefaultFormTemplates(practiceId, user.id)

  const [templatesCount, requestsCount, recentTemplates, recentRequests] = await Promise.all([
    prisma.formTemplate.count({ where: { practiceId } }),
    prisma.formRequest.count({ where: { practiceId } }),
    prisma.formTemplate.findMany({
      where: { practiceId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.formRequest.findMany({
      where: { practiceId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        patient: { select: { name: true, firstName: true, lastName: true } },
        template: { select: { name: true, category: true } },
      },
    }),
  ])

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Forms</h1>
          <p className="text-sm text-gray-500">Create, send, and track patient forms</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/forms/templates/new">
            <Button variant="outline">Create template</Button>
          </Link>
          <Link href="/forms/requests/new">
            <Button className="bg-gray-900 hover:bg-gray-800 text-white">Send form</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{templatesCount}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to send</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Form Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{requestsCount}</div>
            <p className="text-xs text-gray-500 mt-1">Total requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/forms/templates">
              <Button variant="outline" className="w-full">
                Manage templates
              </Button>
            </Link>
            <Link href="/forms/requests/new">
              <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white">
                Send intake form
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Templates</CardTitle>
                <CardDescription>Latest edits across your library</CardDescription>
              </div>
              <Link href="/forms/templates">
                <Button variant="outline" size="sm">
                  View all
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTemplates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-4">No templates yet</p>
                <Link href="/forms/templates/new">
                  <Button>Create template</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTemplates.map((template) => (
                  <Link key={template.id} href={`/forms/templates/${template.id}`}>
                    <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                      <p className="font-medium text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-500">
                        {template.category.replace('_', ' ')} • Updated{' '}
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Requests</CardTitle>
                <CardDescription>Forms sent to patients</CardDescription>
              </div>
              <Link href="/forms/requests/new">
                <Button variant="outline" size="sm">
                  Send form
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-4">No form requests yet</p>
                <Link href="/forms/requests/new">
                  <Button>Send your first form</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900">{request.template.name}</p>
                    <p className="text-xs text-gray-500">
                      {request.patient.name ||
                        `${request.patient.firstName || ''} ${request.patient.lastName || ''}`.trim() ||
                        'Patient'}{' '}
                      • {request.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
