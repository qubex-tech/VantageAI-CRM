import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/middleware'
import { jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const schema = z.object({
  resetToken: z.string().min(1),
  otp: z.string().length(6),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret')

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    if (!rateLimit(`mobile-reset:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { resetToken, otp, newPassword } = parsed.data

    // Verify the reset JWT
    let payload: any
    try {
      const result = await jwtVerify(resetToken, SECRET)
      payload = result.payload
    } catch {
      return NextResponse.json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 })
    }

    if (payload.type !== 'password-reset' || !payload.sub || !payload.otpHash) {
      return NextResponse.json({ error: 'Invalid reset token.' }, { status: 400 })
    }

    // Verify OTP
    const otpValid = await bcrypt.compare(otp, payload.otpHash as string)
    if (!otpValid) {
      return NextResponse.json({ error: 'Incorrect code. Please check and try again.' }, { status: 400 })
    }

    // Update password
    const newHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: payload.sub as string },
      data: { passwordHash: newHash },
    })

    return NextResponse.json({ success: true, message: 'Password updated successfully.' })
  } catch (err) {
    console.error('[mobile/reset-password POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
