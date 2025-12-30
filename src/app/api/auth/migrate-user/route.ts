import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'

/**
 * API endpoint to migrate existing Prisma users to Supabase Auth
 * This creates a Supabase account for a user who exists in Prisma but not Supabase
 * The user will then need to use "Forgot Password" to set their password
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if user exists in Prisma
    const prismaUser = await prisma.user.findUnique({
      where: { email },
    })

    if (!prismaUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Check if Supabase service role key is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase service role key not configured. Contact support.' },
        { status: 500 }
      )
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Try to create user in Supabase (without password - they'll need to reset it)
    // If user already exists, createUser will return an error which we'll handle
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email so they can reset password immediately
      user_metadata: {
        name: prismaUser.name,
      },
    })

    // Check if error is because user already exists
    if (createError) {
      if (createError.message?.includes('already registered') || 
          createError.message?.includes('already exists') ||
          createError.message?.includes('User already registered')) {
        return NextResponse.json({
          message: 'User already exists in Supabase Auth. Please try logging in or use "Forgot Password".',
          exists: true,
        })
      }
      
      console.error('Error creating Supabase user:', createError)
      return NextResponse.json(
        { error: 'Failed to create Supabase account. Please contact support.' },
        { status: 500 }
      )
    }

    if (!newUser.user) {
      return NextResponse.json(
        { error: 'Failed to create Supabase account. Please contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Supabase account created successfully. Please use "Forgot Password" to set your password.',
      success: true,
    })
  } catch (error) {
    console.error('Error migrating user:', error)
    return NextResponse.json(
      { error: 'An error occurred while migrating user account' },
      { status: 500 }
    )
  }
}

