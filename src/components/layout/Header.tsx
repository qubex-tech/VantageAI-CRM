'use client'

import { HealixButton } from '@/components/healix/HealixButton'
import { usePathname } from 'next/navigation'
import { useSidebar } from './SidebarProvider'
import { cn } from '@/lib/utils'

export function Header() {
  const pathname = usePathname()
  const { isCollapsed } = useSidebar()

  // Extract entity IDs from pathname if available
  const patientIdMatch = pathname.match(/\/patients\/([^/]+)/)
  const appointmentIdMatch = pathname.match(/\/appointments\/([^/]+)/)
  const invoiceIdMatch = pathname.match(/\/invoices\/([^/]+)/)

  const screenTitle = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ') || 'Dashboard'

  return (
    <header 
      className={cn(
        "fixed top-0 right-0 z-40 flex items-center justify-end px-4 py-2 h-14 bg-white border-b border-gray-200 transition-all duration-300 ease-in-out max-w-full",
        // Responsive left margin based on sidebar state
        isCollapsed ? "md:left-16" : "md:left-64"
      )}
    >
      <div className="flex items-center gap-2">
        <HealixButton
          patientId={patientIdMatch?.[1]}
          appointmentId={appointmentIdMatch?.[1]}
          invoiceId={invoiceIdMatch?.[1]}
          screenTitle={screenTitle}
        />
      </div>
    </header>
  )
}

