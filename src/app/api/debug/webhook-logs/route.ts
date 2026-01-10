import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to view recent webhook activity
 * GET /api/debug/webhook-logs
 * 
 * This helps debug webhook issues by showing what was received
 */
export async function GET(req: NextRequest) {
  try {
    // Require authentication to view logs
    await requireAuth(req)
    
    // In production, you'd want to store these in a database or log service
    // For now, we'll return instructions on how to check Vercel logs
    return NextResponse.json({
      message: 'Webhook logs are available in your deployment logs',
      instructions: [
        '1. Go to your Vercel dashboard',
        '2. Navigate to your project > Deployments',
        '3. Click on the latest deployment',
        '4. View the "Functions" or "Logs" tab',
        '5. Filter for "cal-webhook" to see webhook requests',
        '',
        'Alternatively, check your server console logs for entries starting with:',
        '[cal-webhook-{timestamp}-{id}]',
        '',
        'To test if webhooks are being received, make a booking in Cal.com and check the logs.',
      ],
      webhookUrl: 'https://app.getvantage.tech/api/cal/webhook',
      expectedSecret: process.env.CALCOM_WEBHOOK_SECRET ? 'configured' : 'not configured',
      note: 'Make sure CALCOM_WEBHOOK_SECRET is set to "vantageai" in your Vercel environment variables',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    )
  }
}

