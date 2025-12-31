import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { CalSettings } from '@/components/settings/CalSettings'
import { RetellSettings } from '@/components/settings/RetellSettings'
import { SendgridSettings } from '@/components/settings/SendgridSettings'

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

  const calIntegration = await prisma.calIntegration.findUnique({
    where: { practiceId: user.practiceId },
    include: {
      eventTypeMappings: true,
    },
  })

  const retellIntegration = await prisma.retellIntegration.findUnique({
    where: { practiceId: user.practiceId },
  })

  // Fetch SendGrid integration, handle gracefully if table doesn't exist yet
  let sendgridIntegration = null
  try {
    sendgridIntegration = await prisma.sendgridIntegration.findUnique({
      where: { practiceId: user.practiceId },
    })
  } catch (error) {
    // Table might not exist if migration hasn't been run yet
    console.error('Error fetching SendGrid integration (table may not exist):', error)
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500">Manage your practice settings</p>
      </div>

      <div className="space-y-6">
        <CalSettings 
          initialIntegration={calIntegration} 
          initialMappings={calIntegration?.eventTypeMappings || []}
        />

        <RetellSettings initialIntegration={retellIntegration} />

        <SendgridSettings initialIntegration={sendgridIntegration} />
      </div>
    </div>
  )
}

