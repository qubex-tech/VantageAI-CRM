import { NextResponse } from 'next/server'

/**
 * Health check endpoint for Inngest
 * This helps verify the route is accessible
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Inngest endpoint is accessible',
    timestamp: new Date().toISOString(),
  })
}

