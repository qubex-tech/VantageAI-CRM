import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    return NextResponse.json({
      hasUrl: !!supabaseUrl,
      urlLength: supabaseUrl?.length || 0,
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing',
      hasKey: !!supabaseAnonKey,
      keyLength: supabaseAnonKey?.length || 0,
      keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : 'missing',
      nodeEnv: process.env.NODE_ENV,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    )
  }
}

