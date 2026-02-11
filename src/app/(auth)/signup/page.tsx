'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Sign-up is disabled. Authentication is OTP-only via the login page.
 */
export default function SignUpPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/login?message=Sign-in is by email link only. Enter your email on this page to receive a sign-in link.')
  }, [router])
  return null
}
