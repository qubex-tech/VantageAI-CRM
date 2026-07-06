import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin, canManagePractice } from '@/lib/permissions'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = req.nextUrl.searchParams.get('practiceId') || user.practiceId
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
    }
    const permissionsUser = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      practiceId: user.practiceId,
      role: user.role,
    }
    if (!isVantageAdmin(permissionsUser) && !canManagePractice(permissionsUser, practiceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [appointmentTypes, calMappings] = await Promise.all([
      prisma.appointment.findMany({
        where: { practiceId, visitType: { not: '' } },
        select: { visitType: true },
        distinct: ['visitType'],
      }),
      prisma.calEventTypeMapping.findMany({
        where: { practiceId },
        select: { visitTypeName: true },
      }),
    ])

    const visitTypes = Array.from(
      new Set([
        ...appointmentTypes.map((row) => row.visitType.trim()).filter(Boolean),
        ...calMappings.map((row) => row.visitTypeName.trim()).filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b))

    return NextResponse.json({ visitTypes })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load visit types' },
      { status: 500 }
    )
  }
}
