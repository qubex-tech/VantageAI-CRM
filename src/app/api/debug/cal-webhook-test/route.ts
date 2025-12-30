import { NextRequest, NextResponse } from 'next/server'

/**
 * Debug endpoint to test if Cal.com webhook is being received
 * This helps diagnose webhook delivery issues
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headers = Object.fromEntries(req.headers.entries())
    
    // Log webhook receipt
    console.log('=== Cal.com Webhook Debug ===')
    console.log('Headers:', headers)
    console.log('Body:', body)
    
    return NextResponse.json({
      received: true,
      timestamp: new Date().toISOString(),
      headers: {
        'x-cal-signature-256': headers['x-cal-signature-256'],
        'x-cal-webhook-version': headers['x-cal-webhook-version'],
        'content-type': headers['content-type'],
      },
      bodyPreview: body.substring(0, 500),
      bodyLength: body.length,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      received: false,
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'This endpoint accepts POST requests from Cal.com webhooks',
    endpoint: '/api/debug/cal-webhook-test',
    method: 'POST',
  })
}

