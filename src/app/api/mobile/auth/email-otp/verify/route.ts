import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/middleware'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const schema = z.object({
  loginToken: z.string().min(1),
  otp: z.string().length(6),
})

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret')

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    if (!rateLimit(`mobile-email-otp-verify:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { loginToken, otp } = parsed.data

    // Verify the short-lived login token
    let payload: any
    try {
      const result = await jwtVerify(loginToken, SECRET)
      payload = result.payload
    } catch {
      return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 })
    }

    if (payload.type !== 'email-login') {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
    }

    const otpValid = await bcrypt.compare(otp, payload.otpHash as string)
    if (!otpValid) {
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub as string } })
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const practice = user.practiceId
      ? await prisma.practice.findUnique({ where: { id: user.practiceId }, select: { name: true } })
      : null

    // Issue 90-day mobile JWT
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
      .sign(SECRET)

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
    console.error('[mobile/auth/email-otp/verify POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
