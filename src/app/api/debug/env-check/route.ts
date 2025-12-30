import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    hasUrl: !!supabaseUrl,
    urlValue: supabaseUrl || 'MISSING',
    urlLength: supabaseUrl?.length || 0,
    hasKey: !!supabaseAnonKey,
    keyValue: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : 'MISSING',
    keyLength: supabaseAnonKey?.length || 0,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
    message: (!supabaseUrl || !supabaseAnonKey) 
      ? 'Environment variables are missing. They must be set in Vercel and a new build must be triggered.'
      : 'Environment variables are present.',
  })
}

