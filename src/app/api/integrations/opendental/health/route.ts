import { NextRequest, NextResponse } from 'next/server'
import { validatePracticeConnection } from '@/lib/integrations/opendental/connectionManager'
import { resolveOpenDentalPractice } from '@/lib/integrations/opendental/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const practiceIdOverride = typeof body.practiceId === 'string' ? body.practiceId : undefined
    const { user, practiceId } = await resolveOpenDentalPractice(practiceIdOverride)

    const result = await validatePracticeConnection(practiceId, user.id)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
