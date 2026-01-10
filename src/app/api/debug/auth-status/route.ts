import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check authentication status
 * Helps diagnose why authentication is failing
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Supabase not configured',
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey,
      })
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Just for debugging - don't actually set cookies in GET requests
        },
      },
    })

    // Check for session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Check for user (this refreshes session)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // Get all cookies
    const allCookies = req.cookies.getAll()
    const supabaseCookies = allCookies.filter(cookie => 
      cookie.name.startsWith('sb-') || cookie.name.includes('supabase')
    )

    return NextResponse.json({
      hasSession: !!session,
      hasUser: !!user,
      sessionError: sessionError?.message,
      userError: userError?.message,
      userId: user?.id,
      userEmail: user?.email,
      sessionExpiresAt: session?.expires_at,
      sessionExpiresIn: session?.expires_at 
        ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000)
        : null,
      cookieCount: allCookies.length,
      supabaseCookieCount: supabaseCookies.length,
      supabaseCookies: supabaseCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value,
        valueLength: c.value?.length || 0,
      })),
      allCookieNames: allCookies.map(c => c.name),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

