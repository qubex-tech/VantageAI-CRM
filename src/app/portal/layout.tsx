import { ReactNode } from 'react'

/**
 * Portal Layout
 * Separate layout for patient portal (no sidebar/header)
 */
export default function PortalLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
