import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { isVantageAdmin, canConfigureAPIs } from '@/lib/permissions'
import { CalSettings } from '@/components/settings/CalSettings'
import { RetellSettings } from '@/components/settings/RetellSettings'
import { SendgridSettings } from '@/components/settings/SendgridSettings'
import { PracticeManagement } from '@/components/settings/PracticeManagement'
import { PracticeAPIConfiguration } from '@/components/settings/PracticeAPIConfiguration'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    const safeErrorMessage = errorMessage.length > 100 
      ? errorMessage.substring(0, 100) + '...'
      : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
  }
  
  if (!user) {
    redirect('/login?error=User account not found.')
  }

  const userForPermissions = {
    id: user.id,
    email: user.email,
    name: user.name,
    practiceId: user.practiceId,
    role: user.role,
  }

  const isVantageAdminUser = isVantageAdmin(userForPermissions)
  const canConfigureAPI = canConfigureAPIs(userForPermissions)

  // Only fetch integrations if user can configure APIs or has a practice
  let calIntegration = null
  let retellIntegration = null
  let sendgridIntegration = null

  if (user.practiceId) {
    const practiceId = user.practiceId
    calIntegration = await prisma.calIntegration.findUnique({
      where: { practiceId: practiceId },
      include: {
        eventTypeMappings: true,
      },
    })

    retellIntegration = await prisma.retellIntegration.findUnique({
      where: { practiceId: practiceId },
    })

    // Fetch SendGrid integration, handle gracefully if table doesn't exist yet
    try {
      sendgridIntegration = await prisma.sendgridIntegration.findUnique({
        where: { practiceId: practiceId },
      })
    } catch (error) {
      // Table might not exist if migration hasn't been run yet
      console.error('Error fetching SendGrid integration (table may not exist):', error)
    }
  }

  // Determine default tab
  const hasVantageAdminTab = isVantageAdminUser
  const hasPracticeApiTab = isVantageAdminUser
  const hasApiTab = canConfigureAPI && user.practiceId
  const defaultTab = hasVantageAdminTab ? "vantage-admin" : hasPracticeApiTab ? "practice-api" : hasApiTab ? "api" : undefined

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500">Manage your practice settings</p>
      </div>

      {(hasVantageAdminTab || hasPracticeApiTab || hasApiTab) ? (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            {hasVantageAdminTab && (
              <TabsTrigger value="vantage-admin">Vantage Admin</TabsTrigger>
            )}
            {hasPracticeApiTab && (
              <TabsTrigger value="practice-api">Practice API Configuration</TabsTrigger>
            )}
            {hasApiTab && (
              <TabsTrigger value="api">API Configuration</TabsTrigger>
            )}
          </TabsList>

          {/* Vantage Admin Tab - Only visible to Vantage Admins */}
          {hasVantageAdminTab && (
            <TabsContent value="vantage-admin" className="mt-6">
              <PracticeManagement />
            </TabsContent>
          )}

          {/* Practice API Configuration Tab - Only visible to Vantage Admins */}
          {hasPracticeApiTab && (
            <TabsContent value="practice-api" className="mt-6">
              <PracticeAPIConfiguration />
            </TabsContent>
          )}

          {/* API Configuration Tab - For users with their own practice */}
          {hasApiTab && (
            <TabsContent value="api" className="mt-6">
              <div className="space-y-6">
                <CalSettings 
                  initialIntegration={calIntegration} 
                  initialMappings={calIntegration?.eventTypeMappings || []}
                />

                <RetellSettings initialIntegration={retellIntegration} />

                <SendgridSettings initialIntegration={sendgridIntegration} />
              </div>
            </TabsContent>
          )}
        </Tabs>
      ) : (
        /* For non-Vantage Admins without practice, show a message */
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">
            API configuration is only available to Vantage Administrators. Contact your administrator for API setup.
          </p>
        </div>
      )}
    </div>
  )
}

