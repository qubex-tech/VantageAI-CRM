import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'

export const dynamic = 'force-dynamic'

function dayBounds(dateStr: string | null, timeZone = 'America/Chicago') {
  const base = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 10)
  // Interpret YYYY-MM-DD as local calendar day in practice TZ via UTC window ±1 day then filter client-side if needed.
  const start = new Date(`${base}T00:00:00.000Z`)
  const end = new Date(`${base}T23:59:59.999Z`)
  // Widen slightly for TZ offset
  start.setUTCHours(start.getUTCHours() - 14)
  end.setUTCHours(end.getUTCHours() + 14)
  return { base, start, end, timeZone }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ appointments: [] })
    }

    if (!(await isAriaScribeEnabled(user.practiceId))) {
      return NextResponse.json(ariaDisabledResponse(), { status: 403 })
    }

    const date = req.nextUrl.searchParams.get('date')
    const { base, start, end } = dayBounds(date)

    const appointments = await prisma.appointment.findMany({
      where: {
        practiceId: user.practiceId,
        startTime: { gte: start, lte: end },
        status: { notIn: ['cancelled'] },
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        visitType: true,
        reason: true,
        status: true,
        timezone: true,
        patient: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            primaryPhone: true,
          },
        },
      },
    })

    // Keep appointments whose local calendar day matches requested date when timezone present
    const filtered = appointments.filter((appt) => {
      try {
        const local = appt.startTime.toLocaleDateString('en-CA', {
          timeZone: appt.timezone || 'America/Chicago',
        })
        return local === base
      } catch {
        return true
      }
    })

    return NextResponse.json({
      date: base,
      appointments: filtered.map((appt) => ({
        id: appt.id,
        startTime: appt.startTime.toISOString(),
        endTime: appt.endTime.toISOString(),
        visitType: appt.visitType,
        reason: appt.reason,
        status: appt.status,
        timezone: appt.timezone,
        patient: {
          id: appt.patient.id,
          name:
            [appt.patient.firstName, appt.patient.lastName].filter(Boolean).join(' ').trim() ||
            appt.patient.name,
          firstName: appt.patient.firstName,
          lastName: appt.patient.lastName,
          dateOfBirth: appt.patient.dateOfBirth?.toISOString() ?? null,
          primaryPhone: appt.patient.primaryPhone,
        },
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/schedule GET]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
