'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
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

  useEffect(() => {
    const msg = searchParams?.get('message')
    if (msg) {
      setMessage(msg)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        setError(`Supabase is not configured. URL: ${supabaseUrl ? '✓' : '✗'}, Key: ${supabaseAnonKey ? '✓' : '✗'}. Please ensure environment variables are set in Vercel and trigger a new deployment.`)
        setLoading(false)
        return
      }

      // Sign in with Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Handle specific Supabase error messages
        let errorMessage = 'Invalid email or password'
        
        if (signInError.message) {
          // Supabase error messages
          if (signInError.message.includes('Invalid API key') || signInError.message.includes('API key')) {
            errorMessage = 'Authentication service configuration error. Please contact support.'
          } else if (signInError.message.includes('Invalid login credentials')) {
            errorMessage = 'Invalid email or password'
          } else if (signInError.message.includes('Email not confirmed')) {
            errorMessage = 'Please verify your email address before signing in'
          } else {
            // Use the error message but make it user-friendly
            errorMessage = signInError.message
          }
        }
        
        setError(errorMessage)
        setLoading(false)
        return
      }

      if (data.user) {
        // Use window.location for full page reload to ensure middleware picks up the session
        window.location.href = callbackUrl
      }
    } catch (err: any) {
      console.error('Login error:', err)
      let errorMessage = 'An unexpected error occurred. Please try again.'
      
      if (err.message) {
        if (err.message.includes('Missing Supabase environment variables')) {
          errorMessage = 'Authentication service is not configured. Please contact support.'
        } else if (err.message.includes('Invalid API key') || err.message.includes('API key')) {
          errorMessage = 'Authentication service configuration error. Please contact support.'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md border border-gray-200 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold text-gray-900">Vantage AI</CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">Sign in to your account</CardDescription>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {message && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{message}</div>
            )}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
            )}
            <Button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <div className="text-center text-sm space-y-2">
              <div>
                Don't have an account?{' '}
                <Link href="/signup" className="text-gray-900 hover:underline font-medium">
                  Sign up
                </Link>
              </div>
              <div>
                <Link href="/forgot-password" className="text-gray-900 hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
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

