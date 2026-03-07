import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'
import { canManageUsers } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/users?practiceId=xxx
 * List users for a practice. Requires canManageUsers for that practice.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const practiceId = searchParams.get('practiceId')

    const userForPermissions = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      practiceId: user.practiceId,
      role: user.role,
    }

    const targetPracticeId = practiceId || user.practiceId
    if (!targetPracticeId) {
      return NextResponse.json(
        { error: 'Practice ID required (query param or your practice).' },
        { status: 400 }
      )
    }

    if (!canManageUsers(userForPermissions, targetPracticeId)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage users for this practice.' },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      where: { practiceId: targetPracticeId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error listing users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Create a new user in a practice. Body: { practiceId, email, name, password, role }.
 * Role must be practice_admin or regular_user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const { practiceId, email, name, password, role } = body

    const userForPermissions = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      practiceId: user.practiceId,
      role: user.role,
    }

    const targetPracticeId = practiceId || user.practiceId
    if (!targetPracticeId) {
      return NextResponse.json(
        { error: 'Practice ID required.' },
        { status: 400 }
      )
    }

    if (!canManageUsers(userForPermissions, targetPracticeId)) {
      return NextResponse.json(
        { error: 'You do not have permission to add users to this practice.' },
        { status: 403 }
      )
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }
    const roleValue = role === 'practice_admin' ? 'practice_admin' : 'regular_user'
    const emailNormalized = email.trim().toLowerCase()

    if (password != null && (typeof password !== 'string' || password.length < 8)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({
      where: { email: emailNormalized },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 400 }
      )
    }

    const practice = await prisma.practice.findUnique({
      where: { id: targetPracticeId },
    })
    if (!practice) {
      return NextResponse.json({ error: 'Practice not found.' }, { status: 404 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin =
      supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null

    if (supabaseAdmin && (password == null || password === '')) {
      return NextResponse.json(
        { error: 'Password is required to create a new user.' },
        { status: 400 }
      )
    }

    if (supabaseAdmin) {
      const { error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
        email: emailNormalized,
        password: password || undefined,
        email_confirm: true,
        user_metadata: { name: name.trim(), role: roleValue },
      })
      if (supabaseError) {
        if (
          supabaseError.message?.includes('already registered') ||
          supabaseError.message?.includes('already exists')
        ) {
          return NextResponse.json(
            { error: 'A user with this email already exists.' },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { error: supabaseError.message || 'Failed to create auth account.' },
          { status: 500 }
        )
      }
    }

    const newUser = await prisma.user.create({
      data: {
        email: emailNormalized,
        name: name.trim(),
        passwordHash: '',
        role: roleValue,
        practiceId: targetPracticeId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    await createAuditLog({
      practiceId: targetPracticeId,
      userId: user.id,
      action: 'create',
      resourceType: 'user',
      resourceId: newUser.id,
      changes: { after: newUser },
    })

    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 500 }
    )
  }
}
