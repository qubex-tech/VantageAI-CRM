import { Suspense } from 'react'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { parseDashboardRangeParam } from '@/lib/analytics/dashboardDateRange'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import {
  DashboardMetricsSection,
} from '@/components/dashboard/DashboardMetricsSection'
import { DashboardMetricsSkeleton } from '@/components/dashboard/DashboardMetricsSkeleton'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; range?: string }>
}) {
  const params = await searchParams
  const initialRange = parseDashboardRangeParam(params)
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
      <Suspense fallback={<DashboardMetricsSkeleton userName={userName} />}>
        <DashboardMetricsSection
          practiceId={user.practiceId}
          userId={user.id}
          userName={userName}
          initialRange={initialRange}
        />
      </Suspense>
    </div>
  )
}
