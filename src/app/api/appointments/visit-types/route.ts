import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin, canManagePractice } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import { usesOpenDentalForRead, usesOpenDentalForWrite } from '@/lib/integrations/clinical-system/types'
import { listOpenDentalAppointmentTypes } from '@/lib/integrations/opendental/scheduling'

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

    const [appointmentTypes, calMappings, scheduling] = await Promise.all([
      prisma.appointment.findMany({
        where: { practiceId, visitType: { not: '' } },
        select: { visitType: true },
        distinct: ['visitType'],
      }),
      prisma.calEventTypeMapping.findMany({
        where: { practiceId },
        select: { visitTypeName: true },
      }),
      getSchedulingSettings(practiceId),
    ])

    const names = new Set<string>([
      ...appointmentTypes.map((row) => row.visitType.trim()).filter(Boolean),
      ...calMappings.map((row) => row.visitTypeName.trim()).filter(Boolean),
    ])

    if (usesOpenDentalForRead(scheduling) || usesOpenDentalForWrite(scheduling)) {
      try {
        const odTypes = await listOpenDentalAppointmentTypes(practiceId)
        for (const row of odTypes) {
          if (!row.isHidden && row.name.trim()) names.add(row.name.trim())
        }
      } catch {
        // Non-fatal — fall back to CRM/Cal names when OD is unreachable.
      }
    }

    const visitTypes = Array.from(names).sort((a, b) => a.localeCompare(b))

    return NextResponse.json({ visitTypes })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load visit types' },
      { status: 500 }
    )
  }
}
