import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice, getEhrSettings, upsertEhrSettings } from '@/lib/integrations/ehr/server'
import { listProviders, getProvider } from '@/lib/integrations/ehr/providers'
import { EhrSettings } from '@/lib/integrations/ehr/types'

const settingsSchema = z.object({
  enabledProviders: z.array(z.string()).default([]),
  providerConfigs: z.record(z.any()).default({}),
  enableWrite: z.boolean().optional(),
  enablePatientCreate: z.boolean().optional(),
  enableNoteCreate: z.boolean().optional(),
  enableBulkExport: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveEhrPractice(practiceIdOverride)
    const settings = await getEhrSettings(practiceId)
    return NextResponse.json({
      settings,
      providers: listProviders().map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        description: provider.description,
        uiFields: provider.uiFields,
        supportsBulkExport: provider.supportsBulkExport || false,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await req.json().catch(() => ({}))
    const practiceIdOverride =
      typeof parsedBody.practiceId === 'string' ? parsedBody.practiceId : undefined
    const { practiceId } = await resolveEhrPractice(practiceIdOverride)
    const parsed = settingsSchema.safeParse(parsedBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
    }

    const providerConfigs: Record<string, unknown> = {}
    for (const [providerId, config] of Object.entries(parsed.data.providerConfigs || {})) {
      const provider = getProvider(providerId as any)
      const result = provider.configSchema.safeParse(config || {})
      if (!result.success) {
        return NextResponse.json(
          { error: `Invalid config for provider ${providerId}` },
          { status: 400 }
        )
      }
      providerConfigs[providerId] = result.data
    }

    const settings: EhrSettings = {
      enabledProviders: parsed.data.enabledProviders as any,
      providerConfigs,
      enableWrite: parsed.data.enableWrite,
      enablePatientCreate: parsed.data.enablePatientCreate,
      enableNoteCreate: parsed.data.enableNoteCreate,
      enableBulkExport: parsed.data.enableBulkExport,
    }
    const stored = await upsertEhrSettings(practiceId, settings)
    return NextResponse.json({ settings: stored.ehrIntegrations })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
