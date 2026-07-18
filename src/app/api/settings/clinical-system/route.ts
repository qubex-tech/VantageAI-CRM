import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getClinicalIntegrationSettings,
  resolveClinicalSystemPractice,
  upsertClinicalIntegrationSettings,
} from '@/lib/integrations/clinical-system/server'
import { CLINICAL_SYSTEM_TYPES, SCHEDULING_SOURCES } from '@/lib/integrations/clinical-system/types'

const visitTypeMappingSchema = z.object({
  visitType: z.string().min(1).max(200),
  aliases: z.array(z.string().min(1).max(200)).default([]),
})

const odReadSlotConfigSchema = z.object({
  provNum: z.number().int().positive(),
  operatoryNums: z.array(z.number().int().positive()).min(1),
  lengthMinutes: z.number().int().positive().max(600),
})

const odBookSlotConfigSchema = z.object({
  provNum: z.number().int().positive(),
  operatoryNums: z.array(z.number().int().positive()).min(1),
  lengthMinutes: z.number().int().positive().max(600),
  visitTypes: z.array(visitTypeMappingSchema).default([]),
})

const schedulingSchema = z
  .object({
    mode: z.enum(['cal', 'open_dental']).optional(),
    readSource: z.enum(SCHEDULING_SOURCES).optional(),
    writeSource: z.enum(SCHEDULING_SOURCES).optional(),
    odReadSlotConfigs: z.array(odReadSlotConfigSchema).nullish(),
    odBookSlotConfigs: z.array(odBookSlotConfigSchema).nullish(),
    defaultReadProvNum: z.number().int().positive().nullish(),
    defaultReadOperatoryNum: z.number().int().positive().nullish(),
    defaultReadOperatoryNums: z.array(z.number().int().positive()).nullish(),
    defaultReadLengthMinutes: z.number().int().positive().max(600).nullish(),
    defaultProvNum: z.number().int().positive().nullish(),
    defaultOperatoryNum: z.number().int().positive().nullish(),
    defaultOperatoryNums: z.array(z.number().int().positive()).nullish(),
    defaultLengthMinutes: z.number().int().positive().max(600).nullish(),
    defaultReadPractitionerRef: z.string().min(1).nullish(),
    defaultReadPractitionerRefs: z.array(z.string().min(1)).nullish(),
    defaultWritePractitionerRef: z.string().min(1).nullish(),
  })
  .superRefine((data, ctx) => {
    const bookConfigs = data.odBookSlotConfigs ?? []
    const visitTypeKeys = new Set<string>()
    for (const [configIndex, config] of bookConfigs.entries()) {
      for (const [vtIndex, mapping] of config.visitTypes.entries()) {
        const vtKey = mapping.visitType.trim().toLowerCase()
        if (visitTypeKeys.has(vtKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Visit type "${mapping.visitType}" is assigned to more than one booking row`,
            path: ['odBookSlotConfigs', configIndex, 'visitTypes', vtIndex, 'visitType'],
          })
        }
        visitTypeKeys.add(vtKey)
      }
    }
    const aliasKeys = new Set<string>()
    for (const [configIndex, config] of bookConfigs.entries()) {
      for (const [vtIndex, mapping] of config.visitTypes.entries()) {
        for (const [aliasIndex, alias] of mapping.aliases.entries()) {
          const aliasKey = alias.trim().toLowerCase()
          if (aliasKeys.has(aliasKey) || visitTypeKeys.has(aliasKey)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Alias "${alias}" collides with another visit type or alias`,
              path: ['odBookSlotConfigs', configIndex, 'visitTypes', vtIndex, 'aliases', aliasIndex],
            })
          }
          aliasKeys.add(aliasKey)
        }
      }
    }
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
