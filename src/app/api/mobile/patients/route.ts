import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

/**
 * GET /api/mobile/patients?search=xxx
 * Returns patients in the practice matching a name/phone/email search.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'No practice associated with this account' }, { status: 403 })
    }

    if (!rateLimit(`${user.id}:mobile-patients`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const search = req.nextUrl.searchParams.get('search')?.trim() ?? ''
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10),
      50
    )

    const where: any = {
      practiceId: user.practiceId,
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { name:         { contains: search, mode: 'insensitive' } },
        { firstName:    { contains: search, mode: 'insensitive' } },
        { lastName:     { contains: search, mode: 'insensitive' } },
        { primaryPhone: { contains: search } },
        { phone:        { contains: search } },
        { email:        { contains: search, mode: 'insensitive' } },
      ]
    }

    const patients = await prisma.patient.findMany({
      where,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        primaryPhone: true,
        phone: true,
        email: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    })

    const shaped = patients.map((p) => ({
      id: p.id,
      name:
        (p.firstName && p.lastName
          ? `${p.firstName} ${p.lastName}`
          : p.name) || 'Unknown',
      phone: p.primaryPhone || p.phone || null,
      email: p.email || null,
    }))

    return NextResponse.json({ patients: shaped })
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/patients GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
