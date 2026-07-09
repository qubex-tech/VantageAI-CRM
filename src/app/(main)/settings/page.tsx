import { redirect } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { isVantageAdmin, canConfigureAPIs, canManageUsers } from '@/lib/permissions'
import { CalSettings } from '@/components/settings/CalSettings'
import { TeamManagement } from '@/components/settings/TeamManagement'
import { HoursOfOperationSettings } from '@/components/settings/HoursOfOperationSettings'
import { RetellSettings } from '@/components/settings/RetellSettings'
import { ResendSettings } from '@/components/settings/SendgridSettings'
import { TwilioSettings } from '@/components/settings/TwilioSettings'
import { TelnyxSettings } from '@/components/settings/TelnyxSettings'
import { CommunicationsSettings } from '@/components/settings/CommunicationsSettings'
import { SmsFromNumberSettings } from '@/components/settings/SmsFromNumberSettings'
import { PracticeManagement } from '@/components/settings/PracticeManagement'
import { PracticeAPIConfiguration } from '@/components/settings/PracticeAPIConfiguration'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageIntro } from '@/components/layout/PageIntro'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireAuthenticatedUser()

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
  let resendIntegration = null
  let twilioIntegration = null
  let telnyxIntegration = null

  if (user.practiceId) {
    const practiceId = user.practiceId
    calIntegration = await prisma.calIntegration.findUnique({
      where: { practiceId: practiceId },
      include: {
        eventTypeMappings: true,
      },
    })

    // Fetch Retell integration, handle gracefully if schema/migration is not yet synced
    try {
      retellIntegration = await prisma.retellIntegration.findUnique({
        where: { practiceId: practiceId },
      })
    } catch (error) {
      console.error('Error fetching Retell integration (schema may be out of sync):', error)
    }

    // Fetch Resend integration, handle gracefully if table doesn't exist yet
    try {
      resendIntegration = await prisma.sendgridIntegration.findUnique({
        where: { practiceId: practiceId },
      })
    } catch (error) {
      // Table might not exist if migration hasn't been run yet
      console.error('Error fetching Resend integration (table may not exist):', error)
    }

    // Fetch Twilio integration, handle gracefully if table doesn't exist yet
    try {
      twilioIntegration = await prisma.twilioIntegration.findUnique({
        where: { practiceId: practiceId },
      })
    } catch (error) {
      // Table might not exist if migration hasn't been run yet
      console.error('Error fetching Twilio integration (table may not exist):', error)
    }

    try {
      telnyxIntegration = await prisma.telnyxIntegration.findUnique({
        where: { practiceId: practiceId },
      })
    } catch (error) {
      console.error('Error fetching Telnyx integration (table may not exist):', error)
    }
  }

  const hasPracticeTab = !!user.practiceId && canManageUsers(userForPermissions, user.practiceId)

  // Determine default tab
  const hasVantageAdminTab = isVantageAdminUser
  const hasPracticeConfigTab = isVantageAdminUser
  const hasApiTab = canConfigureAPI && user.practiceId
  const hasAnyTab = hasVantageAdminTab || hasPracticeConfigTab || hasApiTab || hasPracticeTab
  const defaultTab = hasVantageAdminTab
    ? 'vantage-admin'
    : hasPracticeTab
      ? 'practice'
      : hasPracticeConfigTab
        ? 'practice-config'
        : hasApiTab
          ? 'api'
          : undefined

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6 max-w-4xl">
      <PageIntro description="Manage your practice settings" />

      {hasAnyTab ? (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            {hasPracticeTab && (
              <TabsTrigger value="practice">Practice</TabsTrigger>
            )}
            {hasVantageAdminTab && (
              <TabsTrigger value="vantage-admin">Vantage Admin</TabsTrigger>
            )}
            {hasPracticeConfigTab && (
              <TabsTrigger value="practice-config">Practice Configuration</TabsTrigger>
            )}
            {hasApiTab && (
              <TabsTrigger value="api">API Configuration</TabsTrigger>
            )}
          </TabsList>

          {hasPracticeTab && (
            <TabsContent value="practice" className="mt-6 space-y-6">
              <TeamManagement />
              <HoursOfOperationSettings practiceId={user.practiceId ?? undefined} />
            </TabsContent>
          )}

          {/* Vantage Admin Tab - Only visible to Vantage Admins */}
          {hasVantageAdminTab && (
            <TabsContent value="vantage-admin" className="mt-6">
              <PracticeManagement />
            </TabsContent>
          )}

          {/* Practice Configuration Tab - Only visible to Vantage Admins */}
          {hasPracticeConfigTab && (
            <TabsContent value="practice-config" className="mt-6">
              <PracticeAPIConfiguration />
            </TabsContent>
          )}

          {/* API Configuration Tab - For users with their own practice */}
          {hasApiTab && (
            <TabsContent value="api" className="mt-6">
              <div className="space-y-6">
                <SmsFromNumberSettings practiceId={user.practiceId ?? undefined} />

                <CalSettings 
                  initialIntegration={calIntegration} 
                  initialMappings={calIntegration?.eventTypeMappings || []}
                />

                <RetellSettings initialIntegration={retellIntegration} />

                <ResendSettings initialIntegration={resendIntegration} />

                <CommunicationsSettings initialRetellIntegration={retellIntegration} />

                <TelnyxSettings initialIntegration={telnyxIntegration} />

                <TwilioSettings initialIntegration={twilioIntegration} />
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

