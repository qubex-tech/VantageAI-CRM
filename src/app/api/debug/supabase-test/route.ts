import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
      }, { status: 500 })
    }

    // Test Supabase client initialization and a simple auth operation
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Try to get the current session (this will validate the credentials)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    return NextResponse.json({
      success: true,
      url: supabaseUrl.substring(0, 40) + '...',
      keyLength: supabaseAnonKey.length,
      sessionError: sessionError?.message || null,
      hasSession: !!sessionData?.session,
      testResult: sessionError ? 'FAILED - ' + sessionError.message : 'SUCCESS - Credentials are valid',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

