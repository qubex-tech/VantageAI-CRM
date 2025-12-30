import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

/**
 * Get Supabase client for server-side operations (Server Components, Server Actions)
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options)
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

/**
 * Get Supabase client for API routes (Route Handlers)
 * Accepts a NextRequest to read cookies from the request
 */
export function createSupabaseServerClientForAPI(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // In API routes, we can't set cookies directly in the response
        // Cookies will be handled by the middleware
        cookiesToSet.forEach(({ name }) => {
          // No-op for API routes, cookies are set by middleware
        })
      },
    },
  })
}

/**
 * Get current session from Supabase (Server Components, Server Actions)
 * Uses getUser() to automatically refresh expired sessions, matching middleware behavior
 */
export async function getSupabaseSession() {
  try {
    const supabase = await createSupabaseServerClient()
    // Use getUser() instead of getSession() to automatically refresh expired sessions
    // This matches the middleware behavior and ensures consistent session handling
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    
    if (error || !user) {
      if (error) {
        console.error('Error getting Supabase user:', error)
      }
      return null
    }
    
    // Get session after user is validated (getUser refreshes the session)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      if (sessionError) {
        console.error('Error getting Supabase session:', sessionError)
      }
      return null
    }
    
    return session
  } catch (error) {
    console.error('Exception getting Supabase session:', error)
    // Return null if Supabase is not configured
    return null
  }
}

/**
 * Get current session from Supabase (API routes)
 */
export async function getSupabaseSessionFromRequest(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClientForAPI(req)
    const { data, error } = await supabase.auth.getSession()
    return { data, error }
  } catch (error) {
    console.error('Exception getting Supabase session from request:', error)
    return { data: { session: null }, error: null }
  }
}

/**
 * Get current user from Supabase
 */
export async function getSupabaseUser() {
  const session = await getSupabaseSession()
  return session?.user ?? null
}
