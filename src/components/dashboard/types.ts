import type { DashboardRangeKey } from '@/lib/analytics/dashboardDateRange'

export type {
  CallFeedItem,
  CallFeedPage,
  CallFeedPatientType,
  CallFeedTransferStatus,
} from '@/lib/dashboard/callFeed'

export type { DashboardRangeKey }

export interface DashboardPeriodMetrics {
  range: DashboardRangeKey
  days: number
  rangeLabel: string
  rangeStart: string
  rangeEnd: string
  callsHandled: number
  transfersAttempted: number
  transfersSuccessful: number
  transfersUnsuccessful: number
}

export interface DashboardMetricsPayload {
  timeZone: string
  periods: Record<DashboardRangeKey, DashboardPeriodMetrics>
}
