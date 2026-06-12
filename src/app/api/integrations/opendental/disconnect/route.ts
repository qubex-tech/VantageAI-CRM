import { NextRequest, NextResponse } from 'next/server'
import { disableOpenDentalConnection, getOpenDentalConnection, sanitizeConnectionForResponse } from '@/lib/integrations/opendental/factory'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'
import { logOpenDentalAudit } from '@/lib/integrations/opendental/audit'
import { getPracticeRegistry } from '@/lib/integrations/opendental/factory'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride = typeof body.practiceId === 'string' ? body.practiceId : undefined
    const { user, practiceId } = await resolveOpenDentalPractice(practiceIdOverride)

    const existing = await getOpenDentalConnection(practiceId)
    if (!existing) {
      return NextResponse.json({ error: 'No Open Dental connection found' }, { status: 404 })
    }

    const connection = await disableOpenDentalConnection(practiceId)
    getPracticeRegistry().unregister(practiceId)

    await logOpenDentalAudit({
      tenantId: practiceId,
      actorUserId: user.id,
      action: 'connection.disabled',
      entity: 'OpenDentalConnection',
      entityId: connection.id,
    })

    return NextResponse.json({ connection: sanitizeConnectionForResponse(connection) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect Open Dental'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
