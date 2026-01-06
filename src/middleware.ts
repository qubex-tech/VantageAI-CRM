import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })
  
  const { pathname } = req.nextUrl

  // Allow access to auth pages and public API routes (webhooks)
  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  
  // Allow Inngest endpoint (required for Inngest to call back)
  if (isPublicPath || 
      pathname.startsWith('/api/cal/webhook') || 
      pathname.startsWith('/api/retell/webhook') ||
      pathname.startsWith('/api/inngest')) {
    return res
  }

  // Check Supabase session if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    })

    // Use getUser() instead of getSession() - it refreshes the session automatically
    // This ensures the session stays valid and cookies are properly updated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Protect all other routes
    if (!user && !pathname.startsWith('/api/auth')) {
      const loginUrl = new URL('/login', req.url)
      // Validate callbackUrl to prevent open redirect vulnerabilities
      // Only allow relative paths starting with /
      const safeCallbackUrl = pathname.startsWith('/') && !pathname.startsWith('//') 
        ? pathname 
        : '/dashboard'
      loginUrl.searchParams.set('callbackUrl', safeCallbackUrl)
      return NextResponse.redirect(loginUrl)
    }
  }
  // Note: If Supabase not configured, we'll allow access for now
  // This allows the app to work with NextAuth until fully migrated

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

