import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { canConfigureAPIs } from '@/lib/permissions'
import { EhrIntegrationsSettings } from '@/components/settings/EhrIntegrationsSettings'

export const dynamic = 'force-dynamic'

export default async function EhrIntegrationsPage() {
  const session = await getSupabaseSession()
  if (!session?.user) {
    redirect('/login')
  }

  const user = await syncSupabaseUserToPrisma(session.user)
  if (!user) {
    redirect('/login?error=User account not found')
  }

  const canConfigure = canConfigureAPIs({
    id: user.id,
    email: user.email,
    name: user.name,
    practiceId: user.practiceId,
    role: user.role,
  })

  if (!canConfigure) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          You do not have permission to manage EHR integrations.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">EHR Integrations</h1>
        <p className="text-sm text-gray-500">
          Configure SMART on FHIR providers per practice.
        </p>
      </div>
      <EhrIntegrationsSettings />
    </div>
  )
}
