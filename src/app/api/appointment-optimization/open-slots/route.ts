import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin, canManagePractice } from '@/lib/permissions'
import { ingestOpenTimeSlot } from '@/lib/appointment-optimization/openSlotInventory'
import { evaluateOpenTimeSlot } from '@/lib/appointment-optimization/rulesEngine'
import type { OpenSlotSource, OpenTimeSlotOriginSystem } from '@/lib/appointment-optimization/types'

const bodySchema = z.object({
  practiceId: z.string().optional(),
  visitType: z.string().min(1),
  providerId: z.string().nullable().optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  openSlotSource: z
    .enum(['cancellation', 'no_show', 'reschedule', 'availability'])
    .optional(),
  sourceAppointmentId: z.string().nullable().optional(),
  originSystem: z
    .enum(['crm', 'ecw', 'opendental', 'calcom', 'manual', 'unknown'])
    .optional(),
  evaluate: z.boolean().optional().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = bodySchema.parse(await req.json())
    const practiceId = body.practiceId || user.practiceId
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

    const slot = {
      practiceId,
      visitType: body.visitType,
      providerId: body.providerId ?? null,
      start: new Date(body.start),
      end: new Date(body.end),
      openSlotSource: (body.openSlotSource ?? 'availability') as OpenSlotSource,
      sourceAppointmentId: body.sourceAppointmentId ?? null,
      origin: {
        system: (body.originSystem ?? 'manual') as OpenTimeSlotOriginSystem,
      },
    }

    const { id } = await ingestOpenTimeSlot(slot)
    const result = body.evaluate
      ? await evaluateOpenTimeSlot({ ...slot, inventoryId: id })
      : { action: 'skipped' as const, reason: 'evaluate_disabled' }

    return NextResponse.json({ inventoryId: id, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to ingest open slot' },
      { status: 500 }
    )
  }
}
