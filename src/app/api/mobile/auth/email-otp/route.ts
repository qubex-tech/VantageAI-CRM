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

const OTP_EMAIL_HTML = (otp: string) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:28px;font-weight:700;color:#111827;margin-bottom:8px">VantageAI</div>
    <div style="font-size:14px;color:#6B7280;margin-bottom:32px">Medical CRM</div>
    <div style="font-size:16px;color:#111827;margin-bottom:24px">Your sign-in code:</div>
    <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#3B6FEA;background:#EEF3FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">${otp}</div>
    <div style="font-size:14px;color:#6B7280">This code expires in <strong>15 minutes</strong>.<br>If you didn't request this, you can safely ignore this email.</div>
  </div>
`

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    if (!rateLimit(`mobile-email-otp:${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
    }

    const { email } = parsed.data
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Always 200 to prevent enumeration
    if (!user) {
      return NextResponse.json({ loginToken: 'none', message: 'If that email exists, a code was sent.' })
    }

    const otp = genOtp()
    const otpHash = await bcrypt.hash(otp, 10)

    // 15-min JWT carrying the user id + otp hash
    const loginToken = await new SignJWT({ sub: user.id, otpHash, type: 'email-login' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(SECRET)

    // Send via practice-scoped Resend, then env fallback
    try {
      const { getSendgridClient } = await import('@/lib/sendgrid')
      let sent = false

      if (user.practiceId) {
        try {
          const client = await getSendgridClient(user.practiceId)
          await client.sendEmail({
            to: user.email,
            subject: 'Your VantageAI sign-in code',
            htmlContent: OTP_EMAIL_HTML(otp),
            textContent: `Your VantageAI sign-in code is: ${otp}\n\nExpires in 15 minutes.`,
          })
          sent = true
        } catch {}
      }

      if (!sent && process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL ?? process.env.SENDGRID_FROM_EMAIL ?? 'noreply@getvantage.tech',
            to: [user.email],
            subject: 'Your VantageAI sign-in code',
            html: OTP_EMAIL_HTML(otp),
            text: `Your VantageAI sign-in code is: ${otp}\n\nExpires in 15 minutes.`,
          }),
        })
      }
    } catch (emailErr) {
      console.error('[mobile/auth/email-otp] email send failed', emailErr)
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Sign-in OTP for ${user.email}: ${otp}`)
    }

    return NextResponse.json({ loginToken, message: 'If that email exists, a code was sent.' })
  } catch (err) {
    console.error('[mobile/auth/email-otp POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
