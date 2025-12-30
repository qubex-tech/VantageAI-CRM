import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Debug endpoint to check database configuration
 * Helps verify if using Session Mode (5432) vs Transaction Mode (6543)
 */
export async function GET() {
  const databaseUrl = process.env.DATABASE_URL || ''
  
  // Extract port and mode information
  const portMatch = databaseUrl.match(/:(\d+)\//)
  const port = portMatch ? portMatch[1] : 'unknown'
  
  const isPooler = databaseUrl.includes('pooler.supabase.com')
  const isDirect = databaseUrl.includes('db.supabase.co')
  
  let mode = 'Unknown'
  let recommendation = ''
  
  if (port === '5432') {
    if (isPooler) {
      mode = 'Session Mode Pooler (⚠️ Limited connections ~15-20)'
      recommendation = 'Add ?connection_limit=1 to DATABASE_URL in Vercel (required for Session Mode)'
    } else if (isDirect) {
      mode = 'Direct Connection (⚠️ No pooling, very limited)'
      recommendation = 'Switch to Session Mode Pooler with connection_limit=1'
    } else {
      mode = 'Direct Connection'
      recommendation = 'Use Session Mode Pooler with connection_limit=1'
    }
  } else if (port === '6543') {
    mode = 'Transaction Mode Pooler (✅ Recommended for serverless)'
    recommendation = 'Configuration looks correct! If errors persist, try Session Mode with connection_limit=1'
  } else {
    mode = `Port ${port} - Mode unknown`
    recommendation = 'Use Session Mode Pooler (port 5432) with connection_limit=1'
  }
  
  // Check for connection_limit parameter
  const hasConnectionLimit = databaseUrl.includes('connection_limit')
  
  // Extract connection_limit value if present
  const connectionLimitMatch = databaseUrl.match(/connection_limit=(\d+)/)
  const connectionLimitValue = connectionLimitMatch ? connectionLimitMatch[1] : null
  
  // Mask the password in the URL for display
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':***@')
  
  // Try to test the connection
  let connectionTest = { status: 'not_tested', error: null }
  try {
    await prisma.$queryRaw`SELECT 1 as test`
    connectionTest = { status: 'success', error: null }
  } catch (error) {
    connectionTest = { 
      status: 'failed', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
  
  return NextResponse.json({
    port,
    mode,
    isPooler,
    isDirect,
    hasConnectionLimit,
    connectionLimitValue,
    connectionTest,
    maskedUrl,
    recommendation,
    fixInstructions: port === '5432' && !hasConnectionLimit ? {
      step1: 'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
      step2: 'Find DATABASE_URL and click Edit',
      step3: `Add ?connection_limit=1 to the end of the URL (before any existing ? parameters)`,
      step4: 'Example: ...postgres?connection_limit=1 (or ...postgres?existing_param=value&connection_limit=1)',
      step5: 'Save and Redeploy',
    } : null,
    instructions: {
      step1: 'Go to Supabase Dashboard → Settings → Database',
      step2: 'Scroll to Connection Pooling section',
      step3: 'Find "Transaction mode" (NOT Session mode)',
      step4: 'Copy the connection string (should have port 6543)',
      step5: 'Update DATABASE_URL in Vercel Environment Variables',
      step6: 'Redeploy your application',
    },
  })
}

