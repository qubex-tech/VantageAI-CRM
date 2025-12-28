import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyRetellSignature, rateLimit } from '@/lib/middleware'
import { processRetellWebhook } from '@/lib/retell'

/**
 * RetellAI webhook endpoint
 * Processes voice agent events and tool calls
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

    // Verify webhook signature
    const secret = process.env.RETELLAI_WEBHOOK_SECRET
    if (secret && !verifyRetellSignature(body, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)

    // Extract practiceId from webhook metadata or use a default
    // In production, you might want to route based on phone number or other identifier
    // For now, we'll use a header or require it in the event
    const practiceId = req.headers.get('x-practice-id') || event.practiceId

    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 })
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

