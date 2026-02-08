import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyRetellSignature, rateLimit } from '@/lib/middleware'
import { processRetellWebhook } from '@/lib/retell'

/**
 * RetellAI webhook endpoint
 * Processes call events per https://docs.retellai.com/features/webhook-overview
 * Events: call_started, call_ended, call_analyzed
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(`retell-webhook:${ip}`, 200, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.text()
    const signature = req.headers.get('x-retell-signature') || ''

    if (!body?.trim()) {
      console.warn('[RetellAI webhook] Empty request body received')
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    // Verify webhook signature (skip when RETELLAI_SKIP_SIGNATURE_VERIFICATION=1 for local testing)
    const skipVerification = process.env.RETELLAI_SKIP_SIGNATURE_VERIFICATION === '1'
    const secret = process.env.RETELLAI_WEBHOOK_SECRET
    if (!skipVerification && secret && !verifyRetellSignature(body, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)

    // Debug log (no PHI): confirms payload - per https://docs.retellai.com/features/webhook-overview
    console.log('[RetellAI webhook] Received', {
      eventType: event.event,
      callId: event.call?.call_id,
      hasTranscript: !!(event.call?.transcript ?? event.transcript?.content),
      hasToolCalls: !!(event.tool_calls?.length),
      hasCallAnalysis: !!event.call?.call_analysis,
      bodyLength: body.length,
    })

    // Extract practiceId: query param (for RetellAI URL config), header, event payload, or env default
    const url = new URL(req.url)
    const practiceId =
      url.searchParams.get('practiceId') ||
      req.headers.get('x-practice-id') ||
      event.practiceId ||
      process.env.RETELLAI_DEFAULT_PRACTICE_ID

    if (!practiceId) {
      return NextResponse.json(
        {
          error:
            'Practice ID required. Pass ?practiceId=xxx in the webhook URL, X-Practice-Id header, or set RETELLAI_DEFAULT_PRACTICE_ID.',
        },
        { status: 400 }
      )
    }

    // Verify practice exists
    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
    })

    if (!practice) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    }

    // Process webhook
    const result = await processRetellWebhook(practiceId, event)

    return NextResponse.json(result)
  } catch (error) {
    console.error('RetellAI webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

