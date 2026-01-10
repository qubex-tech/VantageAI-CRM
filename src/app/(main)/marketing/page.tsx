import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Mail, MessageSquare, Settings, Play, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MarketingPage() {
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
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">Marketing features require a practice account.</p>
        </div>
      </div>
    )
  }

  // Get stats
  const [templatesCount, brandProfile] = await Promise.all([
    prisma.marketingTemplate.count({
      where: { tenantId: user.practiceId },
    }),
    prisma.brandProfile.findUnique({
      where: { tenantId: user.practiceId },
    }),
  ])

  const publishedCount = await prisma.marketingTemplate.count({
    where: {
      tenantId: user.practiceId,
      status: 'published',
    },
  })

  const recentTemplates = await prisma.marketingTemplate.findMany({
    where: { tenantId: user.practiceId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      createdBy: {
        select: {
          name: true,
        },
      },
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Marketing</h1>
        <p className="text-sm text-gray-500">Manage templates, branding, and communications</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{templatesCount}</div>
            <p className="text-xs text-gray-500 mt-1">{publishedCount} published</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Brand Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{brandProfile ? 'Configured' : 'Not Set'}</div>
            <p className="text-xs text-gray-500 mt-1">Brand profile status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Sender Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{brandProfile?.defaultFromEmail ? 'Set' : 'Not Set'}</div>
            <p className="text-xs text-gray-500 mt-1">Email & SMS senders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Test Center</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">Ready</div>
            <p className="text-xs text-gray-500 mt-1">Preview & test templates</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link href="/marketing/templates">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Templates
              </CardTitle>
              <CardDescription>Create and manage email & SMS templates</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/marketing/brand">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Brand Settings
              </CardTitle>
              <CardDescription>Configure logo, colors, fonts, and footer</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/marketing/senders">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Sender Settings
              </CardTitle>
              <CardDescription>Set default senders and quiet hours</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Templates</CardTitle>
              <CardDescription>Latest template updates</CardDescription>
            </div>
            <Link href="/marketing/templates">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTemplates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No templates yet</p>
              <Link href="/marketing/templates/new">
                <Button>Create Template</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTemplates.map((template: any) => (
                <Link key={template.id} href={`/marketing/templates/${template.id}`}>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {template.channel === 'email' ? (
                          <Mail className="h-4 w-4 text-gray-400" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900">{template.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          template.status === 'published' 
                            ? 'bg-green-100 text-green-700' 
                            : template.status === 'archived'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {template.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {template.category} • Updated {new Date(template.updatedAt).toLocaleDateString()}
                      </p>
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
