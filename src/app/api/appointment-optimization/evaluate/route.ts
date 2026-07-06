import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin, canManagePractice } from '@/lib/permissions'
import {
  runSlotFillRulesForPractice,
  ingestAndEvaluateOpenTimeSlot,
} from '@/lib/appointment-optimization/runSlotFillRules'
import type { OpenSlotSource, OpenTimeSlotOriginSystem } from '@/lib/appointment-optimization/types'

const slotSchema = z
  .object({
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
  })
  .optional()

const bodySchema = z.object({
  practiceId: z.string().optional(),
  slot: slotSchema,
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

    if (body.slot) {
      const slot = {
        practiceId,
        visitType: body.slot.visitType,
        providerId: body.slot.providerId ?? null,
        start: new Date(body.slot.start),
        end: new Date(body.slot.end),
        openSlotSource: (body.slot.openSlotSource ?? 'availability') as OpenSlotSource,
        sourceAppointmentId: body.slot.sourceAppointmentId ?? null,
        origin: {
          system: (body.slot.originSystem ?? 'manual') as OpenTimeSlotOriginSystem,
        },
      }
      const result = await ingestAndEvaluateOpenTimeSlot(slot)
      return NextResponse.json({ mode: 'single', ...result })
    }

    const summary = await runSlotFillRulesForPractice(practiceId)
    return NextResponse.json({ mode: 'batch', ...summary })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to evaluate slot fill rules' },
      { status: 500 }
    )
  }
}
