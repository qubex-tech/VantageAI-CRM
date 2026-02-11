'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Password reset is disabled. Authentication is OTP-only via the login page.
 */
export default function ForgotPasswordPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/login?message=Sign-in is by email link only. Enter your email to receive a sign-in link.')
  }, [router])
  return null
}
