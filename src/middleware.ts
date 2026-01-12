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
  const host = req.headers.get('host') || ''
  
  // Check if request is for portal domain
  const isPortalDomain = host === 'portal.getvantage.tech' || 
                         host.startsWith('portal.getvantage.tech:') ||
                         host.includes('.portal.getvantage.tech')
  
  // Check if request is for CRM domain (app.getvantage.tech or getvantage.tech)
  const isCrmDomain = host === 'app.getvantage.tech' || 
                      host.startsWith('app.getvantage.tech:') ||
                      host === 'getvantage.tech' ||
                      host.startsWith('getvantage.tech:') ||
                      (!isPortalDomain && host.includes('getvantage.tech'))

  // Portal domain routing
  if (isPortalDomain) {
    // Redirect root to /portal (let the page handle auth check)
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/portal', req.url))
    }
    
    // Block CRM routes on portal domain
    if (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/patients') ||
        pathname.startsWith('/appointments') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/automations') ||
        pathname.startsWith('/workflows') ||
        pathname.startsWith('/calls') ||
        pathname.startsWith('/marketing') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/reset-password')) {
      // Return 404 for CRM routes on portal domain
      return new NextResponse('Not Found', { status: 404 })
    }
    
    // Allow portal routes and portal API routes
    if (pathname.startsWith('/portal') || 
        pathname.startsWith('/api/portal')) {
      return res
    }
    
    // Allow webhooks on portal domain (shared infrastructure)
    if (pathname.startsWith('/api/cal/webhook') || 
        pathname.startsWith('/api/retell/webhook') ||
        pathname.startsWith('/api/inngest') ||
        pathname.startsWith('/api/webhooks')) {
      return res
    }
    
    // For portal domain, default to portal routes
    return res
  }
  
  // CRM domain routing
  if (isCrmDomain) {
    // Block portal routes on CRM domain
    if (pathname.startsWith('/portal')) {
      // Return 404 for portal routes on CRM domain
      return new NextResponse('Not Found', { status: 404 })
    }
    
    // Allow access to auth pages and public API routes (webhooks)
    const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password']
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
    
    // Allow Inngest endpoint (required for Inngest to call back)
    if (isPublicPath || 
        pathname.startsWith('/api/cal/webhook') || 
        pathname.startsWith('/api/retell/webhook') ||
        pathname.startsWith('/api/inngest') ||
        pathname.startsWith('/api/webhooks')) {
      return res
    }
    
    // Check Supabase session for CRM domain (portal has its own auth)
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

      // Protect all other routes on CRM domain
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
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

