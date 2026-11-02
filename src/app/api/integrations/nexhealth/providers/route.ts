import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicalSystemPractice } from '@/lib/integrations/clinical-system/server'
import { listNexhealthProviders } from '@/lib/integrations/nexhealth/client'
import { asNexhealthEnvironment, requireNexhealthConnection } from '@/lib/integrations/nexhealth/connection'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const connection = await requireNexhealthConnection(practiceId)
    const providers = await listNexhealthProviders(
      asNexhealthEnvironment(connection.environment),
      connection.subdomain,
      connection.locationId
    )
    return NextResponse.json({
      providers: providers
        .filter((provider) => provider.inactive !== true)
        .map((provider) => ({
          id: provider.id,
          name:
            provider.name ||
            provider.display_name ||
            [provider.first_name, provider.last_name].filter(Boolean).join(' ') ||
            `Provider ${provider.id}`,
        })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load NexHealth providers'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
