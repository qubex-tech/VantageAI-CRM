import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'
import { canManageUsers } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

function getTargetUserAndCheckPermission(
  currentUser: Awaited<ReturnType<typeof requireAuth>>,
  targetId: string
) {
  const userForPermissions = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name ?? null,
    practiceId: currentUser.practiceId,
    role: currentUser.role,
  }
  return { userForPermissions }
}

/**
 * PATCH /api/users/[id]
 * Update user name and/or role. Requires canManageUsers for the user's practice.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth(req)
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, practiceId: true, email: true, name: true, role: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!targetUser.practiceId) {
      return NextResponse.json(
        { error: 'Cannot update a user without a practice.' },
        { status: 400 }
      )
    }

    const { userForPermissions } = getTargetUserAndCheckPermission(currentUser, id)
    if (!canManageUsers(userForPermissions, targetUser.practiceId)) {
      return NextResponse.json(
        { error: 'You do not have permission to update this user.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { name, role } = body
    const updateData: { name?: string; role?: string } = {}
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim()
    }
    if (role === 'practice_admin' || role === 'regular_user') {
      updateData.role = role
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ user: targetUser })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    await createAuditLog({
      practiceId: targetUser.practiceId,
      userId: currentUser.id,
      action: 'update',
      resourceType: 'user',
      resourceId: id,
      changes: { before: targetUser, after: updated },
    })

    return NextResponse.json({ user: updated })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]
 * Revoke user access: remove from Supabase Auth + Prisma.
 * Requires canManageUsers for the user's practice (practice admin or vantage admin).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth(req)
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Cannot revoke yourself
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'You cannot revoke your own access.' },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { practice: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!targetUser.practiceId) {
      return NextResponse.json(
        { error: 'Cannot delete a user without a practice.' },
        { status: 400 }
      )
    }

    const userForPermissions = {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name ?? null,
      practiceId: currentUser.practiceId,
      role: currentUser.role,
    }
    if (!canManageUsers(userForPermissions, targetUser.practiceId)) {
      return NextResponse.json(
        { error: 'You do not have permission to remove this user.' },
        { status: 403 }
      )
    }

    // Delete from Supabase Auth (by email, since we don't store supabase user id)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let page = 1
      const perPage = 1000
      let found = false
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (error) {
          console.error('listUsers error:', error.message)
          break
        }
        const users = data?.users ?? []
        const match = users.find((u) => u.email?.toLowerCase() === targetUser.email.toLowerCase())
        if (match) {
          await supabaseAdmin.auth.admin.deleteUser(match.id)
          found = true
          break
        }
        if (users.length < perPage) break
        page++
      }
    }

    // Delete from Prisma (cascades to related records)
    await prisma.user.delete({ where: { id } })

    if (targetUser.practiceId) {
      await createAuditLog({
        practiceId: targetUser.practiceId,
        userId: currentUser.id,
        action: 'delete',
        resourceType: 'user',
        resourceId: id,
        changes: { before: { email: targetUser.email, role: targetUser.role } },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke user' },
      { status: 500 }
    )
  }
}
