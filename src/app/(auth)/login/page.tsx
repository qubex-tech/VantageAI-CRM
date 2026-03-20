'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

type AuthMethod = 'otp' | 'password'

function LoginForm() {
  const searchParams = useSearchParams()
  
  // Validate callbackUrl to prevent open redirect vulnerabilities
  const rawCallbackUrl = searchParams?.get('callbackUrl') || '/dashboard'
  const callbackUrl = rawCallbackUrl.startsWith('/') && !rawCallbackUrl.startsWith('//')
    ? rawCallbackUrl
    : '/dashboard'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')

  useEffect(() => {
    const msg = searchParams?.get('message')
    if (msg) setMessage(msg)
  }, [searchParams])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.href = callbackUrl
      }
    })
    return () => subscription.unsubscribe()
  }, [callbackUrl])

  const ensureSupabaseConfigured = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      setError(`Supabase is not configured. URL: ${supabaseUrl ? '✓' : '✗'}, Key: ${supabaseAnonKey ? '✓' : '✗'}. Please ensure environment variables are set in Vercel and trigger a new deployment.`)
      return false
    }

    return true
  }

  const handleOtpSubmit = async () => {
    setError('')
    setLoading(true)
    setEmailSent(false)

    try {
      if (!ensureSupabaseConfigured()) {
        setLoading(false)
        return
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
        },
      })

      if (signInError) {
        console.error('Supabase OTP error:', signInError)
        let errorMessage = 'Could not send sign-in link.'
        if (signInError.message?.includes('Invalid API key')) {
          errorMessage = 'Authentication service configuration error. Please contact support.'
        } else if (signInError.message) {
          errorMessage = signInError.message
        }
        setError(errorMessage)
        setLoading(false)
        return
      }

      setEmailSent(true)
    } catch (err: unknown) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async () => {
    setError('')
    setLoading(true)
    setEmailSent(false)

    try {
      if (!ensureSupabaseConfigured()) {
        setLoading(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        console.error('Supabase password sign-in error:', signInError.message)
        setError('Invalid email or password. Please try again.')
        return
      }

      window.location.href = callbackUrl
    } catch (err: unknown) {
      console.error('Password login error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (authMethod === 'password') {
      await handlePasswordSubmit()
      return
    }

    await handleOtpSubmit()
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md border border-gray-200 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold text-gray-900">Vantage AI</CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">
            {authMethod === 'password'
              ? 'Sign in with your email and password'
              : emailSent
                ? 'Check your email'
                : 'Sign in with a one-time link sent to your email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-4 rounded-md bg-gray-100 p-1">
            <button
              type="button"
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                authMethod === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => {
                setAuthMethod('password')
                setError('')
                setPassword('')
                setEmailSent(false)
              }}
            >
              Password
            </button>
            <button
              type="button"
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                authMethod === 'otp' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => {
                setAuthMethod('otp')
                setError('')
                setPassword('')
              }}
            >
              Email Link
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={authMethod === 'otp' && emailSent}
              />
            </div>
            {authMethod === 'password' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-gray-700 hover:text-gray-900 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            )}
            {message && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{message}</div>
            )}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
            )}
            {authMethod === 'otp' && emailSent ? (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                We sent a sign-in link to <strong>{email}</strong>. Click the link in that email to sign in.
                You can close this tab after opening the link.
              </div>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium"
              disabled={loading || (authMethod === 'password' && password.trim().length === 0)}
            >
              {authMethod === 'password'
                ? loading
                  ? 'Signing in...'
                  : 'Sign in with password'
                : loading
                  ? 'Sending link...'
                  : emailSent
                    ? 'Send another link'
                    : 'Send sign-in link'}
            </Button>
            {authMethod === 'otp' && emailSent && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setEmailSent(false)}
              >
                Use a different email
              </Button>
            )}
            <div className="text-center text-xs text-gray-500 pt-2">
              {authMethod === 'password'
                ? 'Password is the primary sign-in method. Use Email Link if needed.'
                : 'Email Link is available as a fallback sign-in method.'}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  )
}

