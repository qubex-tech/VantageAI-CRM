'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { HealixCommandCenter } from '@/components/healix/HealixCommandCenter'
import { DashboardFrontDeskMetrics } from '@/components/dashboard/DashboardFrontDeskMetrics'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import type { DashboardMetricsPayload } from '@/components/dashboard/types'
import type { HealixContextPayload } from '@/hooks/useHealixContext'

interface DashboardViewProps {
  userName: string
  metrics: DashboardMetricsPayload
  initialDays?: 7 | 30
}

export function DashboardView({ userName, metrics, initialDays = 7 }: DashboardViewProps) {
  const searchParams = useSearchParams()
  const urlDays = searchParams.get('days') === '30' ? 30 : 7
  const [days, setDays] = useState<7 | 30>(initialDays ?? urlDays)

  const active = metrics.periods[days]

  const setDaysInstant = useCallback((value: 7 | 30) => {
    if (value === days) return
    setDays(value)
    const url = value === 7 ? '/dashboard' : '/dashboard?days=30'
    window.history.replaceState(null, '', url)
  }, [days])

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
      <DashboardPageHeader
        userName={userName}
        days={days}
        rangeLabel={active.rangeLabel}
        onDaysChange={setDaysInstant}
      />

      <div className="mb-6">
        <HealixCommandCenter
          context={healixContext}
          frontDeskStats={{
            callsHandled: active.callsHandled,
            transfersSuccessful: active.transfersSuccessful,
            transfersUnsuccessful: active.transfersUnsuccessful,
            transfersAttempted: active.transfersAttempted,
            days: active.days,
          }}
        />
      </div>

      <DashboardFrontDeskMetrics
        days={days}
        callsHandled={active.callsHandled}
        transfersSuccessful={active.transfersSuccessful}
        transfersUnsuccessful={active.transfersUnsuccessful}
        transfersAttempted={active.transfersAttempted}
      />
    </>
  )
}
