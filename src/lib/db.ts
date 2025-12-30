import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure database URL
// For Transaction Mode (port 6543): Use connection_limit=1 (recommended for serverless)
// For Session Mode (port 5432): Use connection_limit=5 (has low total limits anyway)
let databaseUrl = process.env.DATABASE_URL || ''
const portMatch = databaseUrl.match(/:(\d+)\//)
const port = portMatch ? portMatch[1] : ''

// Add connection_limit if not already present
// For Transaction Mode, use 1 connection per instance (pooler handles the rest)
// For Session Mode, use 5 connections per instance (but total pool is small)
if (databaseUrl && !databaseUrl.includes('connection_limit')) {
  const urlMatch = databaseUrl.match(/^(postgresql?:\/\/[^?]+)(\?.*)?$/)
  if (urlMatch) {
    const baseUrl = urlMatch[1]
    const existingParams = urlMatch[2] || ''
    const params = new URLSearchParams(existingParams.replace(/^\?/, ''))
    
    // Transaction Mode (6543): Use 1 connection per instance (recommended)
    // Session Mode (5432): Use 5 connections per instance
    const connectionLimit = port === '6543' ? '1' : '5'
    params.set('connection_limit', connectionLimit)
    
    if (!params.has('pool_timeout')) {
      params.set('pool_timeout', '10') // Timeout after 10 seconds
    }
    
    const paramString = params.toString()
    databaseUrl = paramString 
      ? `${baseUrl}?${paramString}`
      : baseUrl
  }
}

// Configure Prisma with connection limits to prevent exhausting the pool
// Supabase Session Pooler has limits, so we need to be conservative
const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] as Prisma.LogLevel[]
    : ['error'] as Prisma.LogLevel[],
  datasources: {
    db: {
      url: databaseUrl || process.env.DATABASE_URL,
    },
  },
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions)

// Ensure Prisma Client is reused across requests (important for serverless)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} else {
  // In production, also reuse the client to prevent connection leaks
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma
  }
}

/**
 * Tenant-scoped query helpers
 * These ensure all queries are scoped to a practiceId
 */
export const tenantScope = {
  /**
   * Scope a Prisma query to a practice
   */
  scopeQuery: <T extends { practiceId?: string }>(
    query: T,
    practiceId: string
  ): T & { practiceId: string } => {
    return {
      ...query,
      practiceId,
    }
  },

  /**
   * Ensure a result belongs to the practice
   */
  validateTenant: <T extends { practiceId: string } | null>(
    result: T,
    practiceId: string,
    resourceName: string = 'Resource'
  ): T => {
    if (!result) {
      throw new Error(`${resourceName} not found`)
    }
    if (result.practiceId !== practiceId) {
      throw new Error(`${resourceName} does not belong to this practice`)
    }
    return result
  },
}

