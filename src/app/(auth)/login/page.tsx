'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
function LoginForm() {
  const searchParams = useSearchParams()
  
  // Validate callbackUrl to prevent open redirect vulnerabilities
  const rawCallbackUrl = searchParams?.get('callbackUrl') || '/dashboard'
  const callbackUrl = rawCallbackUrl.startsWith('/') && !rawCallbackUrl.startsWith('//')
    ? rawCallbackUrl
    : '/dashboard'
  
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [emailSent, setEmailSent] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setEmailSent(false)

    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        setError(`Supabase is not configured. URL: ${supabaseUrl ? '✓' : '✗'}, Key: ${supabaseAnonKey ? '✓' : '✗'}. Please ensure environment variables are set in Vercel and trigger a new deployment.`)
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md border border-gray-200 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold text-gray-900">Vantage AI</CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">
            {emailSent ? 'Check your email' : 'Sign in with a one-time link sent to your email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                disabled={emailSent}
              />
            </div>
            {message && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{message}</div>
            )}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
            )}
            {emailSent ? (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                We sent a sign-in link to <strong>{email}</strong>. Click the link in that email to sign in.
                You can close this tab after opening the link.
              </div>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium"
              disabled={loading}
            >
              {loading ? 'Sending link...' : emailSent ? 'Send another link' : 'Send sign-in link'}
            </Button>
            {emailSent && (
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
              Sign-in is by email only. No password required.
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

