import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/me
 * Returns current user profile including practice name for white-label UI (e.g. sidebar).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    let practiceName: string | null = null

    if (user.practiceId) {
      const practice = await prisma.practice.findUnique({
        where: { id: user.practiceId },
        select: { name: true },
      })
      practiceName = practice?.name ?? null
    }

    return NextResponse.json({
      practiceName,
      name: user.name,
      email: user.email,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
