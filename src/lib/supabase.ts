import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// After the check, we know these are defined, but TypeScript doesn't
// We can safely use non-null assertions here since we've validated them
const url = supabaseUrl as string
const key = supabaseAnonKey as string

// Server-side Supabase client
export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Client-side Supabase client (for use in components)
export function createSupabaseClient() {
  return createClient(url, key)
}

