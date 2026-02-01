import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice, getEhrSettings } from '@/lib/integrations/ehr/server'
import { getProvider } from '@/lib/integrations/ehr/providers'

const bodySchema = z.object({
  providerId: z.string(),
  practiceId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { practiceId } = await resolveEhrPractice(parsed.data.practiceId)
    const settings = await getEhrSettings(practiceId)
    if (!settings?.enableBulkExport) {
      return NextResponse.json({ error: 'Bulk export disabled' }, { status: 403 })
    }
    if (!settings?.enabledProviders?.includes(parsed.data.providerId as any)) {
      return NextResponse.json({ error: 'Provider not enabled for tenant' }, { status: 403 })
    }

    const provider = getProvider(parsed.data.providerId as any)
    if (!provider.supportsBulkExport) {
      return NextResponse.json({ error: 'Provider does not support bulk export' }, { status: 400 })
    }

    return NextResponse.json({
      status: 'not_implemented',
      message: 'Bulk export scaffolded. Implement Inngest job for polling.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start bulk export'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
