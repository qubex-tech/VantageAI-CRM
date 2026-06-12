import { Suspense } from 'react'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import {
  DashboardMetricsSection,
  DashboardMetricsSkeleton,
} from '@/components/dashboard/DashboardMetricsSection'

export const dynamic = 'force-dynamic'

function resolveDashboardDays(searchParams: { days?: string }): 7 | 30 {
  return searchParams.days === '30' ? 30 : 7
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const initialDays = resolveDashboardDays(params)
  const user = await requireAuthenticatedUser()

  if (!user.practiceId) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6">
        <DashboardPageHeader
          userName={user.name || 'User'}
          rangeLabel="Practice analytics unavailable"
        />
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-lg shadow-gray-200/50">
          <p className="text-sm text-gray-600">
            As a Vantage Admin, you can manage practices from the Settings page.
          </p>
        </div>
      </div>
    )
  }

  const userName = user.name || user.email || 'User'

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-6 min-w-0 max-w-full">
      <Suspense fallback={<DashboardMetricsSkeleton />}>
        <DashboardMetricsSection
          practiceId={user.practiceId}
          userId={user.id}
          userName={userName}
          initialDays={initialDays}
        />
      </Suspense>
    </div>
  )
}
