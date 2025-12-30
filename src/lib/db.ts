import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma with connection limits to prevent exhausting the pool
// Supabase Session Pooler has limits, so we need to be conservative
const prismaClientOptions = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
}

// Add connection limit via DATABASE_URL if not already present
// This helps prevent hitting Supabase's max clients limit
const databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl && !databaseUrl.includes('connection_limit')) {
  // Parse and add connection_limit parameter
  const url = new URL(databaseUrl.replace(/^postgresql:\/\//, 'http://'))
  url.searchParams.set('connection_limit', '5') // Limit to 5 connections per Prisma instance
  url.searchParams.set('pool_timeout', '10') // Timeout after 10 seconds
  // Reconstruct the URL
  const modifiedUrl = databaseUrl.replace(/\?.*$/, '') + '?' + url.searchParams.toString()
  prismaClientOptions.datasources.db.url = modifiedUrl.replace(/^http:\/\//, 'postgresql://')
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

