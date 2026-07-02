import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getClinicalIntegrationSettings,
  resolveClinicalSystemPractice,
  upsertClinicalIntegrationSettings,
} from '@/lib/integrations/clinical-system/server'
import { CLINICAL_SYSTEM_TYPES, SCHEDULING_MODES } from '@/lib/integrations/clinical-system/types'

const schedulingSchema = z.object({
  mode: z.enum(SCHEDULING_MODES),
  defaultReadProvNum: z.number().int().positive().nullish(),
  defaultReadOperatoryNum: z.number().int().positive().nullish(),
  defaultReadOperatoryNums: z.array(z.number().int().positive()).nullish(),
  defaultReadLengthMinutes: z.number().int().positive().max(600).nullish(),
  defaultProvNum: z.number().int().positive().nullish(),
  defaultOperatoryNum: z.number().int().positive().nullish(),
  defaultOperatoryNums: z.array(z.number().int().positive()).nullish(),
  defaultLengthMinutes: z.number().int().positive().max(600).nullish(),
})

const settingsSchema = z
  .object({
    system: z.enum(CLINICAL_SYSTEM_TYPES).optional(),
    scheduling: schedulingSchema.optional(),
  })
  .refine((data) => data.system !== undefined || data.scheduling !== undefined, {
    message: 'Provide system and/or scheduling settings',
  })

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const result = await getClinicalIntegrationSettings(practiceId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load clinical system settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride = typeof body.practiceId === 'string' ? body.practiceId : undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const parsed = settingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid clinical system settings' }, { status: 400 })
    }

    await upsertClinicalIntegrationSettings(practiceId, parsed.data)
    const result = await getClinicalIntegrationSettings(practiceId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update clinical system settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
