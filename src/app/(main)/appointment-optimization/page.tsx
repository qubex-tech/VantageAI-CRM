import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { canManagePractice, isVantageAdmin } from '@/lib/permissions'
import { AppointmentOptimizationDashboard } from '@/components/appointment-optimization/AppointmentOptimizationDashboard'
import { PageIntro } from '@/components/layout/PageIntro'

export const dynamic = 'force-dynamic'

export default async function AppointmentOptimizationPage() {
  const user = await requireAuthenticatedUser()
  if (!user.practiceId) redirect('/login')

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
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
      <PageIntro
        description="Open slots, outreach waves, and fill status. Patients reschedule via the portal only."
        actions={
          <Link href="/settings" className="text-sm text-blue-600 hover:underline">
            Outbound agent settings
          </Link>
        }
      />
      <AppointmentOptimizationDashboard />
    </div>
  )
}
