'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AnalyticsCallRow } from '@/lib/analytics/callSort'
import { AnalyticsCallDateRangeBar } from '@/components/analytics/AnalyticsCallDateRangeBar'
import { CallReportingTable } from '@/components/analytics/CallReportingTable'
import type { CallAnalyticsSectionProps } from '@/components/analytics/CallAnalyticsSection'
import { CallAnalyticsSection } from '@/components/analytics/CallAnalyticsSection'

type TabValue = 'calls' | 'reporting'

function parseTab(raw: string | null): TabValue {
  return raw === 'reporting' ? 'reporting' : 'calls'
}

export type AnalyticsTabsProps = CallAnalyticsSectionProps & {
  reportingRows: AnalyticsCallRow[]
  callFrom: string
  callTo: string
  callRangeLabel: string
}

export function AnalyticsTabs(props: AnalyticsTabsProps) {
  const { reportingRows, callFrom, callTo, callRangeLabel, ...callProps } = props
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))

  const setTab = (next: TabValue) => {
    const p = new URLSearchParams(searchParams.toString())
    if (next === 'reporting') {
      p.set('tab', 'reporting')
    } else {
      p.delete('tab')
    }
    const q = p.toString()
    router.replace(q ? `/analytics?${q}` : '/analytics', { scroll: false })
  }

  return (
    <div className="w-full space-y-0">
      <AnalyticsCallDateRangeBar callFrom={callFrom} callTo={callTo} callRangeLabel={callRangeLabel} />
      <Tabs value={tab} onValueChange={(v) => setTab(parseTab(v))} className="w-full">
        <TabsList className="mb-4 h-auto w-full max-w-md flex-wrap justify-start gap-1 p-1 sm:w-auto">
          <TabsTrigger value="calls" className="px-4 py-2">
            Call analytics
          </TabsTrigger>
          <TabsTrigger value="reporting" className="px-4 py-2">
            Reporting
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calls" className="mt-0 space-y-0 focus-visible:ring-0">
          <CallAnalyticsSection {...callProps} />
        </TabsContent>
        <TabsContent value="reporting" className="mt-0 focus-visible:ring-0">
          <CallReportingTable rows={reportingRows} callRangeLabel={callRangeLabel} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
