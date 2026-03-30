import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/middleware'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const MOBILE_JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret'
)

/**
 * POST /api/mobile/auth
 *
 * Mobile-specific login endpoint. Validates credentials and returns a
 * long-lived JWT that mobile clients store in SecureStore.
 *
 * The token carries the same claims as the NextAuth JWT so all existing
 * requireAuth() middleware continues to work seamlessly with Bearer tokens.
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

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Issue a JWT with 90-day expiry for mobile (refresh on re-auth)
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      practiceId: user.practiceId,
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
        role: user.role,
      },
    })
  } catch (err) {
    console.error('[mobile/auth POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
