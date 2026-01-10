import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure database URL
// For Transaction Mode (port 6543): Use connection_limit=1 (recommended for serverless)
// For Session Mode (port 5432): Use connection_limit=1 (required for serverless - pool is very limited)
let databaseUrl = process.env.DATABASE_URL || ''
const portMatch = databaseUrl.match(/:(\d+)\//)
const port = portMatch ? portMatch[1] : ''

// Add connection_limit if not already present
// IMPORTANT: Supabase Session Mode has VERY limited pool size (typically 15-20 total connections)
// For serverless environments (Vercel), we MUST use 1 connection per instance to avoid exhaustion
// Transaction Mode (6543) is preferred for serverless as it has better pooling
if (databaseUrl && !databaseUrl.includes('connection_limit')) {
  const urlMatch = databaseUrl.match(/^(postgresql?:\/\/[^?]+)(\?.*)?$/)
  if (urlMatch) {
    const baseUrl = urlMatch[1]
    const existingParams = urlMatch[2] || ''
    const params = new URLSearchParams(existingParams.replace(/^\?/, ''))
    
    // Use 1 connection per instance for BOTH modes (critical for serverless)
    // Transaction Mode (6543): 1 connection (pooler handles the rest)
    // Session Mode (5432): 1 connection (required - pool is very limited)
    params.set('connection_limit', '1')
    
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
// For Transaction Mode (6543): Prisma automatically handles the lack of prepared statements
// For Session Mode (5432): Prepared statements work normally
const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] as Prisma.LogLevel[]
    : ['error'] as Prisma.LogLevel[],
  datasources: {
    db: {
      url: databaseUrl || process.env.DATABASE_URL,
    },
  },
  // Transaction Mode (port 6543) doesn't support prepared statements
  // Prisma detects this automatically, but we can explicitly set connection parameters
}

// Critical: In serverless environments (Vercel), we MUST use a singleton pattern
// Each route handler should reuse the same Prisma Client instance to prevent connection exhaustion
// The global object is shared across all function invocations in the same runtime
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions)

// Always reuse the client in all environments to prevent connection leaks
// In Vercel/serverless, this is especially critical for connection pooling
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

// Cleanup on process exit (important for long-running processes)
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
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

