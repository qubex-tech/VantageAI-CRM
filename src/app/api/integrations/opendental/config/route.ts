import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getOpenDentalConnection,
  sanitizeConnectionForResponse,
  upsertOpenDentalConnection,
} from '@/lib/integrations/opendental/factory'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'
import { logOpenDentalAudit } from '@/lib/integrations/opendental/audit'

const configSchema = z.object({
  displayName: z.string().min(1),
  customerKey: z.string().min(1).optional(),
  developerKey: z.string().min(1).optional(),
  apiMode: z.enum(['remote', 'service', 'local']).optional(),
  baseUrl: z.string().url().optional(),
  fallbackBaseUrls: z.array(z.string().url()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const practiceIdOverride = req.nextUrl.searchParams.get('practiceId') || undefined
    const { practiceId } = await resolveOpenDentalPractice(practiceIdOverride)
    const connection = await getOpenDentalConnection(practiceId)
    if (!connection) {
      return NextResponse.json({ connection: null })
    }
    return NextResponse.json({ connection: sanitizeConnectionForResponse(connection) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Open Dental config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride = typeof body.practiceId === 'string' ? body.practiceId : undefined
    const { user, practiceId } = await resolveOpenDentalPractice(practiceIdOverride)
    const parsed = configSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid configuration' }, { status: 400 })
    }

    const connection = await upsertOpenDentalConnection({
      practiceId,
      displayName: parsed.data.displayName,
      customerKey: parsed.data.customerKey,
      developerKey: parsed.data.developerKey,
      apiMode: parsed.data.apiMode,
      baseUrl: parsed.data.baseUrl,
      fallbackBaseUrls: parsed.data.fallbackBaseUrls,
    })

    await logOpenDentalAudit({
      tenantId: practiceId,
      actorUserId: user.id,
      action: 'config.updated',
      entity: 'OpenDentalConnection',
      entityId: connection.id,
    })

    const updated = await getOpenDentalConnection(practiceId)
    return NextResponse.json({ connection: updated ? sanitizeConnectionForResponse(updated) : null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update Open Dental config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
