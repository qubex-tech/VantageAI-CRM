import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Get Supabase client for server-side operations
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
 * Get current session from Supabase
 */
export async function getSupabaseSession() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting Supabase session:', error)
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
 * Get current user from Supabase
 */
export async function getSupabaseUser() {
  const session = await getSupabaseSession()
  return session?.user ?? null
}

