import { NextRequest } from 'next/server'
import { prisma } from './db'

export interface PracticeContext {
  practiceId: string
  practiceSlug?: string | null
  practiceDomain?: string | null
  practiceName: string
}

/**
 * Extract practice context from request host header
 * Supports subdomain-based routing: {slug}.portal.getvantage.tech
 * Also supports custom domain mapping
 */
export async function getPracticeContext(req: NextRequest): Promise<PracticeContext | null> {
  const host = req.headers.get('host') || ''
  
  // Parse host header
  // Examples:
  // - demo.portal.getvantage.tech -> slug: demo
  // - portal.getvantage.tech -> no slug (primary domain)
  // - custom-domain.com -> check custom domain mapping
  
  // Check for subdomain pattern: {slug}.portal.getvantage.tech
  const subdomainMatch = host.match(/^([^.]+)\.portal\.getvantage\.tech$/)
  if (subdomainMatch) {
    const slug = subdomainMatch[1]
    
    // Find practice by slug
    const practice = await prisma.practice.findFirst({
      where: {
        slug: slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        portalDomain: true,
      },
    })
    
    if (practice) {
      return {
        practiceId: practice.id,
        practiceSlug: practice.slug,
        practiceDomain: practice.portalDomain,
        practiceName: practice.name,
      }
    }
    
    // If slug not found, return null (practice not found)
    return null
  }
  
  // Check for primary domain: portal.getvantage.tech
  if (host === 'portal.getvantage.tech' || host.startsWith('portal.getvantage.tech:')) {
    // Primary domain - could use a default practice or require subdomain
    // For now, we'll require subdomain-based routing
    // In production, you might want to handle this differently
    return null
  }
  
  // Check for custom domain mapping
  // Remove port if present
  const hostWithoutPort = host.split(':')[0]
  const practice = await prisma.practice.findFirst({
    where: {
      portalDomain: hostWithoutPort,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      portalDomain: true,
    },
  })
  
  if (practice) {
    return {
      practiceId: practice.id,
      practiceSlug: practice.slug,
      practiceDomain: practice.portalDomain,
      practiceName: practice.name,
    }
  }
  
  // No practice found
  return null
}

/**
 * Require practice context from request
 * Throws error if practice not found
 */
export async function requirePracticeContext(req: NextRequest): Promise<PracticeContext> {
  const context = await getPracticeContext(req)
  
  if (!context) {
    throw new Error('Practice not found')
  }
  
  return context
}

/**
 * Extract practice context from token-based invite link
 * Used as fallback when subdomain routing isn't available
 */
export async function getPracticeContextFromToken(token: string): Promise<PracticeContext | null> {
  // Token format: {practiceId}:{hash}
  // In production, you'd verify the token signature/hash
  const parts = token.split(':')
  if (parts.length !== 2) {
    return null
  }
  
  const practiceId = parts[0]
  
  const practice = await prisma.practice.findUnique({
    where: {
      id: practiceId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      portalDomain: true,
    },
  })
  
  if (!practice) {
    return null
  }
  
  return {
    practiceId: practice.id,
    practiceSlug: practice.slug,
    practiceDomain: practice.portalDomain,
    practiceName: practice.name,
  }
}
