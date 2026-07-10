'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function ensureRecoverySession() {
      setCheckingSession(true)
      setError('')

      try {
        // PKCE recovery: exchange ?code= in the same browser that requested the reset
        // (code verifier cookie was set by createBrowserClient during resetPasswordForEmail).
        const code = searchParams?.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          // Drop the one-time code from the URL without a full navigation.
          const clean = new URL(window.location.href)
          clean.searchParams.delete('code')
          window.history.replaceState({}, '', clean.pathname + clean.search + clean.hash)
        } else {
          // Legacy implicit-flow links put tokens in the hash.
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
          const accessToken = hashParams.get('access_token') || searchParams?.get('access_token')
          const refreshToken = hashParams.get('refresh_token') || searchParams?.get('refresh_token')

          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (setSessionError) throw setSessionError
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (cancelled) return

        if (!session) {
          setSessionReady(false)
          setError('Invalid or expired reset link. Please request a new one.')
          return
        }

        setSessionReady(true)
      } catch (err: unknown) {
        if (cancelled) return
        setSessionReady(false)
        const message =
          err instanceof Error
            ? err.message
            : 'Invalid or expired reset link. Please request a new one.'
        // Surface a clearer action when the verifier cookie is missing (other browser/device).
        if (/code verifier/i.test(message)) {
          setError(
            'This reset link must be opened in the same browser where you requested it. Request a new link below.'
          )
        } else {
          setError(message)
        }
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    }

    void ensureRecoverySession()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!sessionReady) {
      setError('Invalid or expired reset link. Please request a new one.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login?message=Password reset successful. Please sign in.')
      }, 2000)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reset password. The link may have expired.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-md border border-gray-200 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-gray-900">Password Reset Successful!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Your password has been reset successfully. Redirecting to login...
            </p>
            <Link href="/login">
              <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md border border-gray-200 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold text-gray-900">Reset Password</CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">Enter your new password</CardDescription>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <div className="text-center text-sm text-gray-500 py-6">Verifying reset link...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  disabled={!sessionReady}
                />
                <p className="text-xs text-gray-500">Must be at least 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  disabled={!sessionReady}
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                  {!sessionReady && (
                    <div className="mt-2">
                      <Link href="/forgot-password" className="font-medium underline">
                        Request a new reset link
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium"
                disabled={loading || !sessionReady}
              >
                {loading ? 'Resetting password...' : 'Reset Password'}
              </Button>

              <div className="text-center text-sm">
                <Link href="/login" className="text-gray-900 hover:underline font-medium">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-md border border-gray-200 shadow-lg">
          <CardContent className="p-6">
            <div className="text-center text-gray-500">Loading...</div>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
