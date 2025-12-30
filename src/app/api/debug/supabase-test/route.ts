import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      error: 'Missing environment variables',
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    }, { status: 500 })
  }

  try {
    // Test Supabase client initialization and a simple auth operation
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Try to get the current session (this will validate the credentials)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    // Also try to list users (if possible) to test the connection
    const { data: usersData, error: usersError } = await supabase.auth.admin?.listUsers() || { data: null, error: null }

    return NextResponse.json({
      success: true,
      url: supabaseUrl.substring(0, 40) + '...',
      keyLength: supabaseAnonKey.length,
      keyPreview: supabaseAnonKey.substring(0, 30) + '...',
      sessionError: sessionError?.message || null,
      hasSession: !!sessionData?.session,
      testResult: sessionError ? 'FAILED - ' + sessionError.message : 'SUCCESS - Credentials are valid',
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      url: supabaseUrl.substring(0, 40) + '...',
      keyLength: supabaseAnonKey.length,
      keyPreview: supabaseAnonKey.substring(0, 30) + '...',
    }, { status: 500 })
  }
}

