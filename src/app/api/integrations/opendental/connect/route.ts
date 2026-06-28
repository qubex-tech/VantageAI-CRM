import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { registerAndValidateConnection } from '@/lib/integrations/opendental/connectionManager'
import { sanitizeConnectionForResponse } from '@/lib/integrations/opendental/factory'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'

const connectSchema = z.object({
  displayName: z.string().min(1),
  customerKey: z.string().min(1),
  developerKey: z.string().min(1).optional(),
  apiMode: z.enum(['remote', 'service', 'local']).optional(),
  baseUrl: z.string().url().optional(),
  fallbackBaseUrls: z.array(z.string().url()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride = typeof body.practiceId === 'string' ? body.practiceId : undefined
    const { user, practiceId } = await resolveOpenDentalPractice(practiceIdOverride)
    const parsed = connectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid connection payload' }, { status: 400 })
    }

    const result = await registerAndValidateConnection({
      practiceId,
      displayName: parsed.data.displayName,
      customerKey: parsed.data.customerKey,
      developerKey: parsed.data.developerKey,
      apiMode: parsed.data.apiMode,
      baseUrl: parsed.data.baseUrl,
      fallbackBaseUrls: parsed.data.fallbackBaseUrls,
      actorUserId: user.id,
    })

    return NextResponse.json({
      connection: sanitizeConnectionForResponse(result.connection),
      validation: result.validation,
      health: result.health,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect Open Dental'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
