import { Suspense } from 'react'
import PortalAuthClient from './auth-client'

/**
 * Patient Portal Auth Page
 * OTP-based login (email or SMS)
 */
export default function PortalAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6">
            <div className="h-6 w-40 bg-gray-100 rounded mb-2" />
            <div className="h-4 w-72 bg-gray-100 rounded mb-6" />
            <div className="space-y-3">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      }
    >
      <PortalAuthClient />
    </Suspense>
  )
}
