import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicalSystemPractice } from '@/lib/integrations/clinical-system/server'
import { listNexhealthOperatories } from '@/lib/integrations/nexhealth/client'
import { asNexhealthEnvironment, requireNexhealthConnection } from '@/lib/integrations/nexhealth/connection'

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveClinicalSystemPractice(practiceIdOverride)
    const connection = await requireNexhealthConnection(practiceId)
    const operatories = await listNexhealthOperatories(
      asNexhealthEnvironment(connection.environment),
      connection.subdomain,
      connection.locationId
    )
    return NextResponse.json({
      operatories: operatories
        .filter((operatory) => operatory.inactive !== true)
        .map((operatory) => ({
          id: operatory.id,
          name: operatory.name || operatory.display_name || `Operatory ${operatory.id}`,
        })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load NexHealth operatories'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
