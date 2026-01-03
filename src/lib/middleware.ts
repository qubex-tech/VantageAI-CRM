import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './db'
import crypto from 'crypto'
import { getSupabaseSessionFromRequest } from './auth-supabase'
import { syncSupabaseUserToPrisma } from './sync-supabase-user'

/**
 * Get the current user's session with practiceId
 */
export async function getSession() {
  return getServerSession(authOptions)
}

/**
 * Get the current user with practiceId
 * Throws if not authenticated
 * 
 * @param req Optional NextRequest for API routes. If provided, will try Supabase auth first.
 */
export async function requireAuth(req?: NextRequest) {
  // Try Supabase first if we have a request (API route)
  if (req) {
    try {
      const { data: { session: supabaseSession }, error } = await getSupabaseSessionFromRequest(req)
      
      if (!error && supabaseSession?.user) {
        const user = await syncSupabaseUserToPrisma(supabaseSession.user)
        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            practiceId: user.practiceId,
            role: user.role,
          }
        }
      }
    } catch (error) {
      // Supabase not configured or error, fall back to NextAuth
      console.error('Error getting Supabase session in requireAuth:', error)
    }
  }
  
  // Fallback to NextAuth
  const session = await getSession()
  
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  
  // Vantage admin users may have null practiceId, others must have a practiceId
  if (session.user.role !== 'vantage_admin' && !session.user.practiceId) {
    throw new Error('Unauthorized')
  }
  
  return {
    ...session.user,
    practiceId: session.user.practiceId || null, // Ensure it's explicitly null if undefined
  }
}

/**
 * Middleware helper for API routes
 * Extracts practiceId from session and validates user
 */
export async function withTenant<T>(
  handler: (req: NextRequest, context: { practiceId: string; userId: string }) => Promise<T>
) {
  return async (req: NextRequest): Promise<NextResponse<T> | NextResponse<{ error: string }>> => {
    try {
      const user = await requireAuth(req)
      
      if (!user.practiceId) {
        return NextResponse.json(
          { error: 'Practice ID is required for this operation' },
          { status: 400 }
        ) as NextResponse<{ error: string }>
      }
      
      return NextResponse.json(
        await handler(req, { practiceId: user.practiceId, userId: user.id })
      )
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unauthorized' },
        { status: 401 }
      ) as NextResponse<{ error: string }>
    }
  }
}

/**
 * Rate limiting helper (simple token bucket)
 * In production, use Redis or a dedicated rate limiting service
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(identifier)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

/**
 * Verify RetellAI webhook signature
 * RetellAI uses HMAC-SHA256 for webhook signature verification
 */
export function verifyRetellSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) {
    return false
  }

  try {
    // RetellAI typically sends signature in format: sha256=<hex_hash>
    const receivedHash = signature.replace('sha256=', '')
    
    // Compute expected HMAC-SHA256
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(receivedHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    )
  } catch (error) {
    console.error('RetellAI signature verification error:', error)
    return false
  }
}

/**
 * Verify Cal.com webhook signature
 * Cal.com uses HMAC-SHA256 for webhook signature verification
 * According to: https://cal.com/docs/developing/guides/automation/webhooks
 * The signature is in the x-cal-signature-256 header as a hex-encoded HMAC-SHA256 hash
 */
export function verifyCalSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) {
    return false
  }

  try {
    // Cal.com sends signature as hex-encoded HMAC-SHA256 in x-cal-signature-256 header
    // Create HMAC using the secret key and the payload body
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Constant-time comparison to prevent timing attacks
    // Compare the received signature (hex) with the computed hash (hex)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedHash, 'hex')
    )
  } catch (error) {
    console.error('Cal.com signature verification error:', error)
    return false
  }
}
