import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { serializeScribeSession } from '@/lib/aria/serialize'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  mode: z.enum(['ambient', 'dictation', 'hybrid']).default('hybrid'),
  consent: z.literal(true),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ sessions: [] })
    }
    if (!(await isAriaScribeEnabled(user.practiceId))) {
      return NextResponse.json(ariaDisabledResponse(), { status: 403 })
    }

    const patientId = req.nextUrl.searchParams.get('patientId')
    const status = req.nextUrl.searchParams.get('status')
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10), 100)

    const sessions = await prisma.scribeSession.findMany({
      where: {
        practiceId: user.practiceId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : { status: { not: 'discarded' } }),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
      },
    })

    return NextResponse.json({ sessions: sessions.map(serializeScribeSession) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice required' }, { status: 400 })
    }
    if (!(await isAriaScribeEnabled(user.practiceId))) {
      return NextResponse.json(ariaDisabledResponse(), { status: 403 })
    }

    const body = createSchema.parse(await req.json())

    const patient = await prisma.patient.findFirst({
      where: { id: body.patientId, practiceId: user.practiceId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (body.appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: {
          id: body.appointmentId,
          practiceId: user.practiceId,
          patientId: body.patientId,
        },
        select: { id: true },
      })
      if (!appt) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }
    }

    const session = await prisma.scribeSession.create({
      data: {
        practiceId: user.practiceId,
        patientId: body.patientId,
        appointmentId: body.appointmentId ?? null,
        providerUserId: user.id,
        mode: body.mode,
        status: 'recording',
        consentAt: new Date(),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
      },
    })

    // Prefetch chart context during the visit so Stop only waits on ASR + SOAP.
    const { prefetchAriaContext } = await import('@/lib/aria/process')
    void prefetchAriaContext({
      sessionId: session.id,
      practiceId: user.practiceId,
      patientId: body.patientId,
      appointmentId: body.appointmentId ?? null,
    })

    return NextResponse.json({ session: serializeScribeSession(session) }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: err }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[mobile/scribe/sessions POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
