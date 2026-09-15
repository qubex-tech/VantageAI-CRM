'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { HealixCommandCenter } from '@/components/healix/HealixCommandCenter'
import { DashboardFrontDeskMetrics } from '@/components/dashboard/DashboardFrontDeskMetrics'
import { DashboardCallFeed } from '@/components/dashboard/DashboardCallFeed'
import { DashboardDateRangeToggle } from '@/components/dashboard/DashboardDateRangeToggle'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import { usePageHeaderExtras } from '@/components/layout/PageHeaderExtrasContext'
import {
  dashboardPeriodHealixLabel,
  dashboardPeriodShortLabel,
  dashboardRangePath,
  parseDashboardRangeParam,
  type DashboardRangeKey,
} from '@/lib/analytics/dashboardDateRange'
import type { CallFeedPage, DashboardMetricsPayload } from '@/components/dashboard/types'
import type { HealixContextPayload } from '@/hooks/useHealixContext'

interface DashboardViewProps {
  userName: string
  practiceId: string
  metrics: DashboardMetricsPayload
  feed: CallFeedPage
  initialRange?: DashboardRangeKey
}

export function DashboardView({
  userName,
  practiceId,
  metrics,
  feed,
  initialRange = 'today',
}: DashboardViewProps) {
  const searchParams = useSearchParams()
  const urlRange = parseDashboardRangeParam({
    range: searchParams.get('range'),
    days: searchParams.get('days'),
  })
  const [range, setRange] = useState<DashboardRangeKey>(initialRange ?? urlRange)
  const { setExtras } = usePageHeaderExtras()

  const active = metrics.periods[range]

  const setRangeInstant = useCallback((value: DashboardRangeKey) => {
    setRange((current) => {
      if (value === current) return current
      window.history.replaceState(null, '', dashboardRangePath(value))
      return value
    })
  }, [])

  useEffect(() => {
    setExtras(
      <DashboardDateRangeToggle range={range} onRangeChange={setRangeInstant} />
    )
    return () => setExtras(null)
  }, [range, setRangeInstant, setExtras])

  const healixContext = useMemo<HealixContextPayload>(() => ({
    route: '/dashboard',
    screenTitle: 'Dashboard',
    timeZone: metrics.timeZone,
    dashboardContext: {
      windowStart: active.rangeStart,
      windowEnd: active.rangeEnd,
      frontDeskMetrics: {
        days: active.days,
        timeZone: metrics.timeZone,
        callsHandled: active.callsHandled,
        transfersAttempted: active.transfersAttempted,
        transfersSuccessful: active.transfersSuccessful,
        transfersUnsuccessful: active.transfersUnsuccessful,
      },
    },
  }), [active, metrics.timeZone])

  return (
    <>
      <DashboardPageHeader userName={userName} rangeLabel={active.rangeLabel} />

      <div className="mb-6">
        <HealixCommandCenter
          context={healixContext}
          frontDeskStats={{
            callsHandled: active.callsHandled,
            transfersSuccessful: active.transfersSuccessful,
            transfersUnsuccessful: active.transfersUnsuccessful,
            transfersAttempted: active.transfersAttempted,
            days: active.days,
            periodLabel: dashboardPeriodHealixLabel(range),
          }}
        />
      </div>

      <DashboardFrontDeskMetrics
        periodDetail={dashboardPeriodShortLabel(range)}
        callsHandled={active.callsHandled}
        transfersSuccessful={active.transfersSuccessful}
        transfersUnsuccessful={active.transfersUnsuccessful}
        transfersAttempted={active.transfersAttempted}
      />

      <DashboardCallFeed
        practiceId={practiceId}
        timeZone={metrics.timeZone}
        rangeFrom={active.rangeStart}
        rangeTo={active.rangeEnd}
        initialPage={feed}
        initialRangeFrom={metrics.periods[initialRange].rangeStart}
        initialRangeTo={metrics.periods[initialRange].rangeEnd}
      />
    </>
  )
}
