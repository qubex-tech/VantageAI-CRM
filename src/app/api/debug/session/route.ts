import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check session status
 * Useful for troubleshooting authentication issues
 */
export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      error: 'Supabase not configured',
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    }, { status: 500 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Don't set cookies in GET request
      },
    },
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  const cookies = req.cookies.getAll()
  const supabaseCookies = cookies.filter(c => c.name.startsWith('sb-'))

  return NextResponse.json({
    hasUser: !!user,
    userId: user?.id || null,
    userEmail: user?.email || null,
    hasSession: !!session,
    sessionExpiresAt: session?.expires_at || null,
    userError: userError?.message || null,
    sessionError: sessionError?.message || null,
    cookiesCount: supabaseCookies.length,
    cookieNames: supabaseCookies.map(c => c.name),
    environment: process.env.NODE_ENV,
  })
}

