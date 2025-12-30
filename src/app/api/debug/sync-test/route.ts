import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'

/**
 * Debug endpoint to test user sync
 * Helps diagnose sync failures
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSupabaseSession()
    
    if (!session?.user) {
      return NextResponse.json({
        error: 'Not authenticated',
        message: 'No Supabase session found',
      }, { status: 401 })
    }

    console.log('=== SYNC TEST DEBUG ===')
    console.log('Supabase user email:', session.user.email)
    console.log('Supabase user ID:', session.user.id)
    console.log('User metadata:', session.user.user_metadata)

    try {
      const prismaUser = await syncSupabaseUserToPrisma(session.user)
      
      return NextResponse.json({
        success: true,
        message: 'Sync successful',
        supabaseUser: {
          id: session.user.id,
          email: session.user.email,
        },
        prismaUser: prismaUser ? {
          id: prismaUser.id,
          email: prismaUser.email,
          name: prismaUser.name,
          practiceId: prismaUser.practiceId,
          hasPractice: !!(prismaUser as any).practice,
        } : null,
      })
    } catch (syncError) {
      console.error('=== SYNC ERROR ===')
      console.error('Error type:', syncError instanceof Error ? syncError.constructor.name : typeof syncError)
      console.error('Error message:', syncError instanceof Error ? syncError.message : String(syncError))
      console.error('Error stack:', syncError instanceof Error ? syncError.stack : undefined)
      
      return NextResponse.json({
        success: false,
        error: syncError instanceof Error ? syncError.message : 'Unknown error',
        errorType: syncError instanceof Error ? syncError.constructor.name : typeof syncError,
        stack: syncError instanceof Error ? syncError.stack : undefined,
        supabaseUser: {
          id: session.user.id,
          email: session.user.email,
        },
      }, { status: 500 })
    }
  } catch (error) {
    console.error('=== GENERAL ERROR ===')
    console.error(error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

