import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { serializeScribeSession } from '@/lib/aria/serialize'
import { parseSoapJson } from '@/lib/aria/types'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  addendum: z.string().optional(),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice required' }, { status: 400 })
    }
    if (!(await isAriaScribeEnabled(user.practiceId))) {
      return NextResponse.json(ariaDisabledResponse(), { status: 403 })
    }

    const { id } = await context.params
    const body = patchSchema.parse(await req.json())

    const existing = await prisma.scribeSession.findFirst({
      where: { id, practiceId: user.practiceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (!['ready_for_review', 'generating', 'failed'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot edit note in status ${existing.status}` },
        { status: 400 }
      )
    }

    const current = parseSoapJson(existing.soapJson)
    const soap = {
      ...current,
      ...Object.fromEntries(
        Object.entries(body).filter(([, value]) => typeof value === 'string')
      ),
    }

    const session = await prisma.scribeSession.update({
      where: { id },
      data: {
        soapJson: soap as unknown as Prisma.InputJsonValue,
        status: existing.status === 'failed' ? 'ready_for_review' : existing.status,
        error: null,
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

    return NextResponse.json({ session: serializeScribeSession(session) })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: err }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
