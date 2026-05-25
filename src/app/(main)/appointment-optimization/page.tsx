import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { canManagePractice, isVantageAdmin } from '@/lib/permissions'
import { AppointmentOptimizationDashboard } from '@/components/appointment-optimization/AppointmentOptimizationDashboard'

export const dynamic = 'force-dynamic'

export default async function AppointmentOptimizationPage() {
  const supabaseSession = await getSupabaseSession()
  if (!supabaseSession) redirect('/login')

  const user = await syncSupabaseUserToPrisma(supabaseSession.user)
  if (!user?.practiceId) redirect('/login')

  const permissionsUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    practiceId: user.practiceId,
    role: user.role,
  }

  if (!canManagePractice(permissionsUser, user.practiceId) && !isVantageAdmin(permissionsUser)) {
    redirect('/dashboard')
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Appointment Optimization</h1>
          <p className="text-sm text-gray-500">
            Open slots, outreach waves, and fill status. Patients reschedule via the portal only.
          </p>
        </div>
        <Link
          href="/settings"
          className="text-sm text-blue-600 hover:underline"
        >
          Outbound agent settings
        </Link>
      </div>
      <AppointmentOptimizationDashboard />
    </div>
  )
}
