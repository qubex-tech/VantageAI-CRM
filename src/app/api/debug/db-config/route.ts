import { NextResponse } from 'next/server'

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
      recommendation = 'Switch to Transaction Mode (port 6543) for better connection limits'
    } else if (isDirect) {
      mode = 'Direct Connection (⚠️ No pooling, very limited)'
      recommendation = 'Switch to Transaction Mode Pooler (port 6543)'
    } else {
      mode = 'Direct Connection'
      recommendation = 'Use Transaction Mode Pooler (port 6543)'
    }
  } else if (port === '6543') {
    mode = 'Transaction Mode Pooler (✅ Recommended for serverless)'
    recommendation = 'Configuration looks correct!'
  } else {
    mode = `Port ${port} - Mode unknown`
    recommendation = 'Use Transaction Mode Pooler (port 6543)'
  }
  
  // Check for connection_limit parameter
  const hasConnectionLimit = databaseUrl.includes('connection_limit')
  
  // Mask the password in the URL for display
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':***@')
  
  return NextResponse.json({
    port,
    mode,
    isPooler,
    isDirect,
    hasConnectionLimit,
    maskedUrl,
    recommendation,
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

