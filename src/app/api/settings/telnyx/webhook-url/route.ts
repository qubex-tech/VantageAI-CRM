import { NextResponse } from 'next/server'
import { getTelnyxInboundWebhookUrl } from '@/lib/telnyx'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    webhookUrl: getTelnyxInboundWebhookUrl(),
  })
}
