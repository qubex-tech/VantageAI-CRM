export interface DashboardPeriodMetrics {
  days: 7 | 30
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
  periods: {
    7: DashboardPeriodMetrics
    30: DashboardPeriodMetrics
  }
}
