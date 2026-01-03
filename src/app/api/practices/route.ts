import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'
import { isVantageAdmin } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/practices
 * List all practices (Vantage Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Only Vantage Admins can list all practices
    const userForPermissions = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      practiceId: user.practiceId,
      role: user.role,
    }
    if (!isVantageAdmin(userForPermissions)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only Vantage Admins can view all practices.' },
        { status: 403 }
      )
    }

    const practices = await prisma.practice.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            patients: true,
            appointments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ practices })
  } catch (error) {
    console.error('Error fetching practices:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch practices' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/practices
 * Create a new practice with practice admin and regular users (Vantage Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    // Only Vantage Admins can create practices
    const userForPermissions = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      practiceId: user.practiceId,
      role: user.role,
    }
    if (!isVantageAdmin(userForPermissions)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only Vantage Admins can create practices.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { name, practiceAdmins, regularUsers } = body

    // Validate practice name
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Practice name is required' },
        { status: 400 }
      )
    }

    // Validate practice admins array
    if (!Array.isArray(practiceAdmins)) {
      return NextResponse.json(
        { error: 'practiceAdmins must be an array' },
        { status: 400 }
      )
    }

    // Validate regular users array
    if (!Array.isArray(regularUsers)) {
      return NextResponse.json(
        { error: 'regularUsers must be an array' },
        { status: 400 }
      )
    }

    // Validate all users have required fields
    const allUsers = [...practiceAdmins, ...regularUsers]
    for (const user of allUsers) {
      if (!user.name || !user.email || !user.password) {
        return NextResponse.json(
          { error: 'All users must have name, email, and password' },
          { status: 400 }
        )
      }
      if (user.password.length < 8) {
        return NextResponse.json(
          { error: `Password for ${user.email} must be at least 8 characters` },
          { status: 400 }
        )
      }
    }

    // Check for duplicate emails
    const emails = allUsers.map(u => u.email.toLowerCase())
    const uniqueEmails = new Set(emails)
    if (emails.length !== uniqueEmails.size) {
      return NextResponse.json(
        { error: 'Duplicate email addresses found' },
        { status: 400 }
      )
    }

    // Check if any emails already exist
    const existingUsers = await prisma.user.findMany({
      where: {
        email: {
          in: emails,
        },
      },
    })

    if (existingUsers.length > 0) {
      const existingEmails = existingUsers.map(u => u.email).join(', ')
      return NextResponse.json(
        { error: `The following emails already exist: ${existingEmails}` },
        { status: 400 }
      )
    }

    // Check if Supabase is configured (for creating users in Supabase Auth)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase not configured - creating users without Supabase Auth accounts')
    }

    // Create Supabase admin client if configured
    const supabaseAdmin = supabaseUrl && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      : null

    // Create practice and users in a transaction
    const practice = await prisma.$transaction(async (tx) => {
      // Create practice
      const newPractice = await tx.practice.create({
        data: {
          name: name.trim(),
        },
      })

      // Create users
      const createdPracticeAdmins: any[] = []
      const createdRegularUsers: any[] = []

      // Create practice admin users
      for (const adminData of practiceAdmins) {
        let supabaseUserId: string | null = null

        // Create user in Supabase Auth if configured
        if (supabaseAdmin) {
          try {
            const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
              email: adminData.email.trim().toLowerCase(),
              password: adminData.password,
              email_confirm: true, // Auto-confirm email
              user_metadata: {
                name: adminData.name.trim(),
                role: 'practice_admin',
              },
            })

            if (supabaseError) {
              // If user already exists, try to get them
              if (supabaseError.message?.includes('already registered') || 
                  supabaseError.message?.includes('already exists')) {
                console.warn(`User ${adminData.email} already exists in Supabase Auth`)
                // Continue - we'll create the Prisma user anyway
              } else {
                throw new Error(`Failed to create Supabase user for ${adminData.email}: ${supabaseError.message}`)
              }
            } else if (supabaseUser?.user) {
              supabaseUserId = supabaseUser.user.id
            }
          } catch (supabaseErr) {
            console.error(`Error creating Supabase user for ${adminData.email}:`, supabaseErr)
            // Continue with Prisma user creation even if Supabase fails
          }
        }

        // Create user in Prisma
        const prismaUser = await tx.user.create({
          data: {
            email: adminData.email.trim().toLowerCase(),
            name: adminData.name.trim(),
            passwordHash: '', // Supabase manages passwords, or empty if Supabase not configured
            role: 'practice_admin',
            practiceId: newPractice.id,
          },
        })

        createdPracticeAdmins.push(prismaUser)
      }

      // Create regular users
      for (const userData of regularUsers) {
        let supabaseUserId: string | null = null

        // Create user in Supabase Auth if configured
        if (supabaseAdmin) {
          try {
            const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
              email: userData.email.trim().toLowerCase(),
              password: userData.password,
              email_confirm: true, // Auto-confirm email
              user_metadata: {
                name: userData.name.trim(),
                role: 'regular_user',
              },
            })

            if (supabaseError) {
              // If user already exists, try to get them
              if (supabaseError.message?.includes('already registered') || 
                  supabaseError.message?.includes('already exists')) {
                console.warn(`User ${userData.email} already exists in Supabase Auth`)
                // Continue - we'll create the Prisma user anyway
              } else {
                throw new Error(`Failed to create Supabase user for ${userData.email}: ${supabaseError.message}`)
              }
            } else if (supabaseUser?.user) {
              supabaseUserId = supabaseUser.user.id
            }
          } catch (supabaseErr) {
            console.error(`Error creating Supabase user for ${userData.email}:`, supabaseErr)
            // Continue with Prisma user creation even if Supabase fails
          }
        }

        // Create user in Prisma
        const prismaUser = await tx.user.create({
          data: {
            email: userData.email.trim().toLowerCase(),
            name: userData.name.trim(),
            passwordHash: '', // Supabase manages passwords, or empty if Supabase not configured
            role: 'regular_user',
            practiceId: newPractice.id,
          },
        })

        createdRegularUsers.push(prismaUser)
      }

      return {
        practice: newPractice,
        practiceAdmins: createdPracticeAdmins,
        regularUsers: createdRegularUsers,
      }
    })

    // Create audit logs for practice creation
    await createAuditLog({
      practiceId: practice.practice.id,
      userId: user.id,
      action: 'create',
      resourceType: 'practice',
      resourceId: practice.practice.id,
      changes: { after: practice.practice },
    })

    // Create audit logs for user creation
    for (const adminUser of practice.practiceAdmins) {
      await createAuditLog({
        practiceId: practice.practice.id,
        userId: user.id,
        action: 'create',
        resourceType: 'user',
        resourceId: adminUser.id,
        changes: { after: adminUser },
      })
    }

    for (const regularUser of practice.regularUsers) {
      await createAuditLog({
        practiceId: practice.practice.id,
        userId: user.id,
        action: 'create',
        resourceType: 'user',
        resourceId: regularUser.id,
        changes: { after: regularUser },
      })
    }

    return NextResponse.json(
      {
        practice: practice.practice,
        users: {
          practiceAdmins: practice.practiceAdmins,
          regularUsers: practice.regularUsers,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating practice:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'One or more users with these emails already exist' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create practice' },
      { status: 500 }
    )
  }
}

