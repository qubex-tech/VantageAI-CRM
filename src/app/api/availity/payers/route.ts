import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getAvailityIntegrationConfig, searchAvailityPayers } from '@/lib/availity'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const q = req.nextUrl.searchParams.get('q') || undefined
    const config = await getAvailityIntegrationConfig(user.practiceId)
    const payers = await searchAvailityPayers(config, q)

    return NextResponse.json({ payers })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search Availity payers' },
      { status: 500 }
    )
  }
}
