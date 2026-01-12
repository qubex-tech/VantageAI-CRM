import { ReactNode } from 'react'
import { PortalSidebar } from '@/components/portal/PortalSidebar'

/**
 * Portal Layout
 * Separate layout for patient portal with sidebar navigation
 */
export default function PortalLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PortalSidebar />
      {/* Main content area with sidebar spacing */}
      <div className="md:ml-64 pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
