import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'
import { isVantageAdmin } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/users/[id]
 * Revoke user access: remove from Supabase Auth + Prisma. Vantage Admin only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth(req)

    const userForPermissions = {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name ?? null,
      practiceId: currentUser.practiceId,
      role: currentUser.role,
    }
    if (!isVantageAdmin(userForPermissions)) {
      return NextResponse.json(
        { error: 'Only Vantage Admins can revoke user access.' },
        { status: 403 }
      )
    }

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
