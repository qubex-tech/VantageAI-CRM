import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'

export const dynamic = 'force-dynamic'

/**
 * Test endpoint to manually trigger user sync
 * This helps debug sync issues
 */
export async function GET(req: NextRequest) {
  try {
    console.log('=== TEST SYNC ENDPOINT CALLED ===')
    
    // Get Supabase client with cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }
    
    const cookieStore = await cookies()
    console.log('Cookies:', cookieStore.getAll().map(c => c.name).join(', '))
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch (error) {
            // Ignore - can't set cookies in API route
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch (error) {
            // Ignore
          }
        },
      },
    })
    
    // Get the current Supabase session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('Session error:', sessionError)
    console.log('Supabase session:', session ? 'found' : 'not found')
    
    if (!session?.user) {
      return NextResponse.json(
        { 
          error: 'Not authenticated',
          message: 'No Supabase session found',
          cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
        },
        { status: 401 }
      )
    }

    console.log('Supabase user email:', session.user.email)
    console.log('Supabase user metadata:', session.user.user_metadata)

    // Sync the session user to Prisma
    console.log('Calling syncSupabaseUserToPrisma...')
    const prismaUser = await syncSupabaseUserToPrisma(session.user)
    
    console.log('Sync successful! User ID:', prismaUser.id)
    
    return NextResponse.json({ 
      success: true,
      message: 'User synced successfully',
      user: {
        id: prismaUser.id,
        email: prismaUser.email,
        name: prismaUser.name,
        practiceId: prismaUser.practiceId,
      }
    })
  } catch (error) {
    console.error('=== SYNC ERROR ===')
    console.error(error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync user',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

