'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization: only create client when actually accessed in the browser
// This prevents errors during build/SSR when env vars might not be available
let _supabase: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  // Only create client in browser environment
  if (typeof window === 'undefined') {
    throw new Error('Supabase client can only be used in the browser')
  }
  
  if (!_supabase) {
    // Read environment variables at runtime (they're embedded at build time for NEXT_PUBLIC_* vars)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    _supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return _supabase
}

// Export a Proxy that lazily creates the client on first access
// This allows the module to be imported during build/SSR without throwing errors
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    // During SSR/build, return a no-op to prevent errors
    if (typeof window === 'undefined') {
      if (prop === 'auth') {
        return new Proxy({}, {
          get() {
            throw new Error('Supabase client can only be used in the browser. Make sure this code runs in a useEffect or event handler.')
          }
        })
      }
      throw new Error('Supabase client can only be used in the browser. Make sure this code runs in a useEffect or event handler.')
    }
    
    const client = getSupabaseClient()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
  set(_target, prop: string | symbol, value: any) {
    if (typeof window === 'undefined') {
      return false
    }
    const client = getSupabaseClient()
    ;(client as any)[prop] = value
    return true
  }
})

