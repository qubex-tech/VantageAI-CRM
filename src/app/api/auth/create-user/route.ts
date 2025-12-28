import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'

/**
 * API route to create/sync a Prisma user from Supabase Auth
 * This is called after signup to ensure the user exists in Prisma
 */
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
    return NextResponse.json({ 
      success: true,
      user: {
        id: prismaUser.id,
        email: prismaUser.email,
        name: prismaUser.name,
        practiceId: prismaUser.practiceId,
      }
    })
  } catch (error) {
    console.error('Error syncing user:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync user',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

