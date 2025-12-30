'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

// API route to sync Supabase user to Prisma
async function syncUserToPrisma() {
  const response = await fetch('/api/auth/sync-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to sync user')
  }
  
  return response.json()
}

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validation
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
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('[Signup] Environment check:', {
        hasUrl: !!supabaseUrl,
        urlLength: supabaseUrl?.length || 0,
        hasKey: !!supabaseAnonKey,
        keyLength: supabaseAnonKey?.length || 0,
        urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing',
      })
      
      if (!supabaseUrl || !supabaseAnonKey) {
        setError(`Supabase is not configured. URL: ${supabaseUrl ? '✓' : '✗'}, Key: ${supabaseAnonKey ? '✓' : '✗'}. Please ensure environment variables are set and rebuild the application.`)
        setLoading(false)
        return
      }

      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      })

      if (signUpError) {
        // Handle specific Supabase error messages
        let errorMessage = 'Failed to create account. Please try again.'
        
        if (signUpError.message) {
          console.error('Supabase signup error:', signUpError)
          
          // Supabase error messages
          if (signUpError.message.includes('Invalid API key') || 
              signUpError.message.includes('API key') ||
              signUpError.message.includes('JWT') ||
              signUpError.message.includes('401') ||
              signUpError.message.includes('Unauthorized')) {
            errorMessage = 'Authentication service configuration error. Please verify that the Supabase API key is correct in the environment variables.'
          } else if (signUpError.message.includes('User already registered') || 
                     signUpError.message.includes('already registered') ||
                     signUpError.message.includes('already been registered')) {
            errorMessage = 'An account with this email already exists. If you are an existing user, please use "Forgot Password" to reset your password and create your Supabase account.'
          } else if (signUpError.message.includes('Password')) {
            errorMessage = signUpError.message
          } else if (signUpError.message.includes('Email rate limit')) {
            errorMessage = 'Too many signup attempts. Please wait a few minutes and try again.'
          } else {
            // Use the error message but make it user-friendly
            errorMessage = signUpError.message
          }
        }
        
        setError(errorMessage)
        setLoading(false)
        return
      }

      if (data.user) {
        // Try to sync user to Prisma immediately after signup
        // The session should be available now
        try {
          const syncResponse = await fetch('/api/auth/create-user', {
            method: 'POST',
            credentials: 'include',
          })
          
          if (!syncResponse.ok) {
            console.error('Failed to sync user to database:', await syncResponse.text())
            // Continue anyway - user was created in Supabase and will sync on login
          }
        } catch (syncError) {
          console.error('Error syncing user to database:', syncError)
          // Continue anyway - user will sync on first login
        }
        
        setSuccess(true)
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login?message=Account created! Please sign in.')
        }, 2000)
      }
    } catch (err: any) {
      console.error('Signup error:', err)
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

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account Created!</CardTitle>
            <CardDescription>Please check your email to verify your account</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              We've sent a confirmation email to {email}. Please click the link in the email to verify your account before signing in.
            </p>
            <Link href="/login">
              <Button className="w-full">Go to Login</Button>
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
          <CardTitle className="text-xl font-semibold text-gray-900">Create Account</CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">Sign up for Vantage AI</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

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
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-gray-500">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
            )}

            <Button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-gray-900 hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

