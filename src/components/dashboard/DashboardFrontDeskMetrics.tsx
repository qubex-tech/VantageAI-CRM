'use client'

import { Phone, PhoneForwarded, PhoneOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export interface DashboardFrontDeskMetricsProps {
  days: 7 | 30
  callsHandled: number
  transfersSuccessful: number
  transfersUnsuccessful: number
  transfersAttempted: number
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value)}%`
}

export function DashboardFrontDeskMetrics({
  days,
  callsHandled,
  transfersSuccessful,
  transfersUnsuccessful,
  transfersAttempted,
}: DashboardFrontDeskMetricsProps) {
  const transferredPctOfHandled =
    callsHandled > 0 ? (transfersSuccessful / callsHandled) * 100 : 0
  const failedPctOfAttempts =
    transfersAttempted > 0 ? (transfersUnsuccessful / transfersAttempted) * 100 : 0

  const metrics = [
    {
      title: 'Calls Handled',
      description: 'Inbound calls answered by your AI front desk',
      icon: Phone,
      value: callsHandled,
      detail: `${days}-day total`,
      accent: 'text-lime-500',
      iconBg: 'bg-lime-50',
      iconColor: 'text-lime-600',
    },
    {
      title: 'Calls Transferred',
      description: 'Successfully routed to your team',
      icon: PhoneForwarded,
      value: transfersSuccessful,
      detail: `${formatPercent(transferredPctOfHandled)} of calls handled`,
      accent: 'text-orange-400',
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-400',
    },
    {
      title: 'Failed Transfers',
      description: 'Transfer attempted but could not connect',
      icon: PhoneOff,
      value: transfersUnsuccessful,
      detail:
        transfersAttempted > 0
          ? `${formatPercent(failedPctOfAttempts)} of ${transfersAttempted} transfer attempts`
          : 'No transfer attempts in range',
      accent: 'text-red-500',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
    },
  ]

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card
            key={metric.title}
            className="border border-gray-100 bg-white shadow-lg shadow-gray-200/50 transition-shadow hover:shadow-xl hover:shadow-gray-200/60"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {metric.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {metric.description}
                  </CardDescription>
                </div>
                <div className={`rounded-lg p-2 ${metric.iconBg}`}>
                  <Icon className={`h-4 w-4 ${metric.iconColor}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold tracking-tight ${metric.accent}`}>
                {metric.value.toLocaleString()}
              </div>
              <p className="mt-2 text-xs text-gray-500">{metric.detail}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
