import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Debug endpoint to check current database connection status
 * This helps diagnose connection pool issues
 */
export async function GET() {
  try {
    // Try a simple query to check connection
    const result = await prisma.$queryRaw`SELECT 1 as test`
    
    // Get connection pool info if available
    const poolInfo = await prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        state,
        wait_event_type
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state, wait_event_type
      ORDER BY total_connections DESC
    `.catch(() => null)
    
    const databaseUrl = process.env.DATABASE_URL || ''
    const portMatch = databaseUrl.match(/:(\d+)\//)
    const port = portMatch ? portMatch[1] : 'unknown'
    const isTransactionMode = port === '6543'
    const isSessionMode = port === '5432'
    
    return NextResponse.json({
      status: 'connected',
      testQuery: result,
      poolInfo,
      connectionConfig: {
        port,
        mode: isTransactionMode ? 'Transaction Mode (6543)' : isSessionMode ? 'Session Mode (5432)' : 'Unknown',
        hasConnectionLimit: databaseUrl.includes('connection_limit'),
        urlPreview: databaseUrl.replace(/:([^:@]+)@/, ':***@').substring(0, 100),
      },
      recommendation: isTransactionMode 
        ? 'Using Transaction Mode - if still getting errors, check for connection leaks or try removing connection_limit parameter'
        : 'Switch to Transaction Mode (port 6543)',
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set',
    }, { status: 500 })
  }
}

