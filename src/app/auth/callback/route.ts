import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Handles Supabase OTP magic link callback.
 * Supports both PKCE (code param) and token_hash/type flows.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'magiclink' | 'email' | null
  const next = searchParams.get('next') || '/dashboard'

  if (!code && (!token_hash || !type)) {
    return NextResponse.redirect(new URL('/login?error=Missing auth parameters', req.url))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login?error=Auth not configured', req.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Code exchange error:', error.message)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url)
      )
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (error) {
      console.error('OTP verification error:', error.message)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url)
      )
    }
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(new URL(safeNext, req.url))
}
