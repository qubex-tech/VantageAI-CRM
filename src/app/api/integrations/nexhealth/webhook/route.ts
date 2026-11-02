import { NextRequest, NextResponse } from 'next/server'
import {
  handleNexhealthWebhook,
  listNexhealthWebhookSecrets,
  nexhealthSignatureMatches,
} from '@/lib/integrations/nexhealth/webhooks'
import type { NexhealthWebhookPayload } from '@/lib/integrations/nexhealth/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('timestamp') || ''
  const signature = req.headers.get('signature') || ''
  const secrets = await listNexhealthWebhookSecrets()
  if (
    !nexhealthSignatureMatches({
      rawBody,
      timestamp,
      signature,
      secrets,
    })
  ) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: NexhealthWebhookPayload
  try {
    payload = JSON.parse(rawBody) as NexhealthWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }

  try {
    await handleNexhealthWebhook(payload)
  } catch (error) {
    console.error('[NexHealth webhook] handler failed', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
