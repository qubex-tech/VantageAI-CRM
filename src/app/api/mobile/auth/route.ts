import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/middleware'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const MOBILE_JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret'
)

/**
 * Verify credentials. Tries Supabase Auth first (primary for production users),
 * then falls back to bcrypt for users with a local passwordHash.
 */
async function verifyCredentials(email: string, password: string): Promise<boolean> {
  // Support both NEXT_PUBLIC_ prefix (client-exposed) and plain names (all Vercel envs)
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) return true
      console.log('[mobile/auth] Supabase signIn error:', error.message)
    } catch (e) {
      console.error('[mobile/auth] Supabase client error:', e)
    }
  } else {
    console.warn('[mobile/auth] Supabase env vars not set — skipping Supabase auth')
  }

  return false
}

/**
 * POST /api/mobile/auth
 *
 * Mobile-specific login endpoint. Validates credentials against Supabase Auth
 * (production users) with a bcrypt fallback for locally-hashed accounts.
 * Returns a long-lived JWT stored in SecureStore on the device.
 */
export async function POST(req: NextRequest) {
  try {
    // Basic rate limiting: 10 attempts per minute per IP
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    if (!rateLimit(`mobile-auth:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'Too many login attempts' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 })
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // 1. Try Supabase Auth (all production users created via the web CRM)
    const supabaseValid = await verifyCredentials(email, password)

    // 2. Fall back to bcrypt only for accounts that have a real hash (not empty string)
    const hasLocalHash = user.passwordHash && user.passwordHash.length > 0
    const bcryptValid = !supabaseValid && hasLocalHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false

    console.log(`[mobile/auth] user=${user.email} supabase=${supabaseValid} bcrypt=${bcryptValid} hasHash=${hasLocalHash}`)

    if (!supabaseValid && !bcryptValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const practice = user.practiceId
      ? await prisma.practice.findUnique({ where: { id: user.practiceId }, select: { name: true } })
      : null

    // Issue a JWT with 90-day expiry for mobile (refresh on re-auth)
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      practiceId: user.practiceId,
      practiceName: practice?.name ?? null,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('90d')
      .sign(MOBILE_JWT_SECRET)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        practiceId: user.practiceId,
        practiceName: practice?.name ?? null,
        role: user.role,
      },
    })
  } catch (err) {
    console.error('[mobile/auth POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
