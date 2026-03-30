import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/middleware'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const schema = z.object({ email: z.string().email() })

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret')

const OTP_EMAIL_HTML = (otp: string) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:28px;font-weight:700;color:#111827;margin-bottom:8px">VantageAI</div>
    <div style="font-size:14px;color:#6B7280;margin-bottom:32px">Medical CRM</div>
    <div style="font-size:16px;color:#111827;margin-bottom:24px">Your password reset code:</div>
    <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#3B6FEA;background:#EEF3FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">${otp}</div>
    <div style="font-size:14px;color:#6B7280">This code expires in <strong>15 minutes</strong>.<br>If you didn't request this, you can safely ignore this email.</div>
  </div>
`

function genOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendViaResend(to: string, apiKey: string, fromEmail: string, otp: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: 'Your VantageAI password reset code',
      html: OTP_EMAIL_HTML(otp),
      text: `Your password reset code is: ${otp}\n\nThis code expires in 15 minutes. If you didn't request this, ignore this email.`,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
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

    // Send OTP email — try practice-scoped Resend integration first, then env fallback
    try {
      const { getSendgridClient } = await import('@/lib/sendgrid')
      let sent = false

      if (user.practiceId) {
        try {
          const client = await getSendgridClient(user.practiceId)
          await client.sendEmail({
            to: user.email,
            subject: 'Your VantageAI password reset code',
            htmlContent: OTP_EMAIL_HTML(otp),
            textContent: `Your password reset code is: ${otp}\n\nThis code expires in 15 minutes.`,
          })
          sent = true
        } catch {
          // Practice has no Resend integration — fall through to env key
        }
      }

      // Env-level Resend API key fallback
      if (!sent && process.env.RESEND_API_KEY) {
        await sendViaResend(
          user.email,
          process.env.RESEND_API_KEY,
          process.env.RESEND_FROM_EMAIL ?? process.env.SENDGRID_FROM_EMAIL ?? 'noreply@getvantage.tech',
          otp
        )
        sent = true
      }

      if (!sent) {
        console.warn('[mobile/forgot-password] No email provider configured — OTP not sent')
      }
    } catch (emailErr) {
      console.error('[mobile/forgot-password] email send failed', emailErr)
      // Still return resetToken so the client can proceed (dev/test)
    }

    // In dev, log OTP for easy testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset OTP for ${user.email}: ${otp}`)
    }

    return NextResponse.json({ resetToken, message: 'If that email exists, a code was sent.' })
  } catch (err) {
    console.error('[mobile/forgot-password POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
