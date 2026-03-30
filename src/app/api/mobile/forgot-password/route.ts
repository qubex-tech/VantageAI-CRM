import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/middleware'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const schema = z.object({ email: z.string().email() })

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret')

function genOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    if (!rateLimit(`mobile-forgot:${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
    }

    const { email } = parsed.data
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Always return 200 to prevent email enumeration
    if (!user) {
      return NextResponse.json({ message: 'If that email exists, a code was sent.' })
    }

    const otp = genOtp()
    const otpHash = await bcrypt.hash(otp, 10)

    // Package into a 15-min JWT so no DB state is needed
    const resetToken = await new SignJWT({ sub: user.id, otpHash, type: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(SECRET)

    // Send OTP via SendGrid (practice-scoped) with fallback to env SENDGRID_API_KEY
    try {
      const { getSendgridClient } = await import('@/lib/sendgrid')
      let sgClient: any = null

      if (user.practiceId) {
        try { sgClient = await getSendgridClient(user.practiceId) } catch {}
      }

      // Fallback: use raw SendGrid API key from env
      if (!sgClient && process.env.SENDGRID_API_KEY) {
        const sgModule = await import('@sendgrid/mail')
        const sg = sgModule.default
        sg.setApiKey(process.env.SENDGRID_API_KEY)
        await sg.send({
          to: user.email,
          from: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@getvantage.tech',
          subject: 'Your VantageAI password reset code',
          text: `Your password reset code is: ${otp}\n\nThis code expires in 15 minutes. If you didn't request this, ignore this email.`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <div style="font-size:28px;font-weight:700;color:#111827;margin-bottom:8px">VantageAI</div>
              <div style="font-size:14px;color:#6B7280;margin-bottom:32px">Medical CRM</div>
              <div style="font-size:16px;color:#111827;margin-bottom:24px">Your password reset code:</div>
              <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#3B6FEA;background:#EEF3FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">${otp}</div>
              <div style="font-size:14px;color:#6B7280">This code expires in <strong>15 minutes</strong>.<br>If you didn't request this, you can safely ignore this email.</div>
            </div>
          `,
        })
      } else if (sgClient) {
        await sgClient.sendEmail({
          to: user.email,
          subject: 'Your VantageAI password reset code',
          text: `Your password reset code is: ${otp}\n\nThis code expires in 15 minutes.`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <div style="font-size:28px;font-weight:700;color:#111827;margin-bottom:8px">VantageAI</div>
              <div style="font-size:14px;color:#6B7280;margin-bottom:32px">Medical CRM</div>
              <div style="font-size:16px;color:#111827;margin-bottom:24px">Your password reset code:</div>
              <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#3B6FEA;background:#EEF3FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">${otp}</div>
              <div style="font-size:14px;color:#6B7280">This code expires in <strong>15 minutes</strong>.</div>
            </div>
          `,
        })
      }
    } catch (emailErr) {
      console.error('[mobile/forgot-password] email send failed', emailErr)
      // Still return resetToken so dev/test can use it
    }

    // In dev, log OTP for testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset OTP for ${user.email}: ${otp}`)
    }

    return NextResponse.json({ resetToken, message: 'If that email exists, a code was sent.' })
  } catch (err) {
    console.error('[mobile/forgot-password POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
