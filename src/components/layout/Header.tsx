'use client'

import { HealixButton } from '@/components/healix/HealixButton'
import { PageHeaderExtrasContext } from '@/components/layout/PageHeaderExtrasContext'
import { useContext } from 'react'
import { usePathname } from 'next/navigation'
import { useSidebar } from './SidebarProvider'
import { cn } from '@/lib/utils'

function formatScreenTitle(pathname: string): string {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    patients: 'Patients',
    appointments: 'Appointments',
    'appointment-optimization': 'Slot Fill',
    tasks: 'Tasks',
    communications: 'Inbox',
    'knowledge-base': 'Knowledge Base',
    forms: 'Forms',
    marketing: 'Marketing',
    calls: 'Calls',
    settings: 'Settings',
    workflows: 'Workflow Automations',
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'Dashboard'

  const root = segments[0]
  if (labels[root]) {
    return segments.length === 1 ? labels[root] : labels[root]
  }

  return segments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ')
}

export function Header() {
  const pathname = usePathname()
  const { isCollapsed, isPreVisitFocus } = useSidebar()
  const effectiveCollapsed = isCollapsed || isPreVisitFocus
  const headerExtras = useContext(PageHeaderExtrasContext)
  const extras = headerExtras?.extras ?? null

  const patientIdMatch = pathname.match(/\/patients\/([^/]+)/)
  const appointmentIdMatch = pathname.match(/\/appointments\/([^/]+)/)
  const invoiceIdMatch = pathname.match(/\/invoices\/([^/]+)/)
  const conversationIdMatch = pathname.match(/\/communications\/([^/]+)/)

  const screenTitle = formatScreenTitle(pathname)

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-40 flex h-14 items-center border-b border-gray-200 bg-white px-4 transition-all duration-300 ease-in-out max-w-full',
        effectiveCollapsed ? 'md:left-16' : 'md:left-64'
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight truncate shrink-0">
          {screenTitle}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {extras}
          <HealixButton
            conversationId={conversationIdMatch?.[1]}
            patientId={patientIdMatch?.[1]}
            appointmentId={appointmentIdMatch?.[1]}
            invoiceId={invoiceIdMatch?.[1]}
            screenTitle={screenTitle}
          />
        </div>
      </div>
    </header>
  )
}
