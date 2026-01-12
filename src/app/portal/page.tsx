'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Portal Home Page
 * Redirects to auth if not logged in, otherwise shows home
 */
export default function PortalHomePage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/portal/auth')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Redirecting...</p>
    </div>
  )
}
