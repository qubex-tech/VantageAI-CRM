import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

/**
 * Returns the current authenticated user.
 * Mobile app can call this on startup to verify the stored token is still valid.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
