import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'

export async function POST(req: NextRequest) {
  try {
    // Get the current Supabase session
    const session = await getSupabaseSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Sync the session user to Prisma
    const prismaUser = await syncSupabaseUserToPrisma(session.user)
    return NextResponse.json({ user: prismaUser })
  } catch (error) {
    console.error('Error syncing user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync user' },
      { status: 500 }
    )
  }
}

