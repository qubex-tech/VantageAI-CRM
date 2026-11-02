import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveClinicalSystemPractice } from '@/lib/integrations/clinical-system/server'
import { isNexhealthKeyConfigured, listNexhealthInstitutions } from '@/lib/integrations/nexhealth/client'
import {
  publicNexhealthConnection,
  saveNexhealthConnection,
} from '@/lib/integrations/nexhealth/connection'
import { subscribeNexhealthPractice } from '@/lib/integrations/nexhealth/webhooks'
import type { NexhealthEnvironment } from '@/lib/integrations/nexhealth/types'

const connectSchema = z.object({
  environment: z.enum(['sandbox', 'production']),
  subdomain: z.string().min(1),
  institutionId: z.number().int().positive().optional(),
  locationId: z.number().int().positive(),
  locationName: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride = typeof body.practiceId === 'string' ? body.practiceId : undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const parsed = connectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid NexHealth connection' }, { status: 400 })
    }
    const environment = parsed.data.environment as NexhealthEnvironment
    if (!isNexhealthKeyConfigured(environment)) {
      const keyName = environment === 'production' ? 'NEXHEALTH_API_KEY' : 'NEXHEALTH_SANDBOX_API_KEY'
      return NextResponse.json({ error: `${keyName} is not configured` }, { status: 400 })
    }

    const institutions = await listNexhealthInstitutions(environment)
    const institution = institutions.find((row) => row.subdomain === parsed.data.subdomain.trim())
    const location = institution?.locations.find((row) => row.id === parsed.data.locationId)
    if (!institution || !location) {
      return NextResponse.json(
        { error: 'That NexHealth location is not available to this API key' },
        { status: 400 }
      )
    }

    const connection = await saveNexhealthConnection({
      practiceId,
      environment,
      subdomain: institution.subdomain,
      institutionId: institution.id,
      locationId: location.id,
      locationName: parsed.data.locationName || location.name || institution.name,
    })

    let webhookWarnings: string[] = []
    try {
      webhookWarnings = await subscribeNexhealthPractice(connection)
    } catch (error) {
      webhookWarnings = [error instanceof Error ? error.message : 'Webhook registration failed']
    }

    return NextResponse.json({
      connection: publicNexhealthConnection(connection),
      webhookWarnings,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect NexHealth'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
