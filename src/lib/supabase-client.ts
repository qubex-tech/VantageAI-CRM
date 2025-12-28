'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create Supabase client only if environment variables are configured
// This allows the app to work with NextAuth even if Supabase is not configured
// Components using Supabase should check if it's available before calling methods
let supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error)
  }
} else {
  console.warn(
    'Supabase environment variables not set. Supabase Auth features will not work. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable Supabase Auth.'
  )
}

// Export the client (may be null if not configured)
// Components should check for null before using
export { supabase }

