import { prisma } from './db'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { getSendgridClient } from './sendgrid'
import { getTwilioClient } from './twilio'
import { buildVerifiedPatientPortalUrl } from './portal-invite'

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Hash OTP code for storage
 */
export async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10)
}

/**
 * Verify OTP code
 */
export async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash)
}

/**
 * Send OTP via email or SMS
 */
export async function sendOTP(
  practiceId: string,
  channel: 'email' | 'sms',
  recipient: string,
  code: string
): Promise<boolean> {
  try {
    if (channel === 'email') {
      // Send via SendGrid
      const sendgridClient = await getSendgridClient(practiceId)
      
      // Get practice info for personalized email
      const practice = await prisma.practice.findUnique({
        where: { id: practiceId },
        select: { name: true },
      })
      
      const practiceName = practice?.name || 'Your Practice'
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h1 style="color: #2563eb; margin-top: 0;">Patient Portal Login Code</h1>
              <p>Hello,</p>
              <p>You requested a login code for the ${practiceName} Patient Portal.</p>
              <div style="background-color: #ffffff; border: 2px solid #2563eb; border-radius: 6px; padding: 20px; text-align: center; margin: 20px 0;">
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0;">${code}</p>
              </div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="font-size: 12px; color: #6b7280;">This is an automated message from ${practiceName}. Please do not reply to this email.</p>
            </div>
          </body>
        </html>
      `
      
      const textContent = `
Patient Portal Login Code

Hello,

You requested a login code for the ${practiceName} Patient Portal.

Your login code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

---
This is an automated message from ${practiceName}. Please do not reply to this email.
      `.trim()
      
      const result = await sendgridClient.sendEmail({
        to: recipient,
        subject: `${practiceName} - Your Patient Portal Login Code`,
        htmlContent,
        textContent,
      })
      
      if (!result.success) {
        console.error(`Failed to send OTP email to ${recipient}:`, result.error)
        // Fallback to console log in development
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[EMAIL] OTP for ${recipient}: ${code}`)
        }
        return false
      }
      
      return true
    } else if (channel === 'sms') {
      const twilioClient = await getTwilioClient(practiceId)
      const result = await twilioClient.sendSms({
        to: recipient,
        body: `Your patient portal login code is ${code}. This code expires in 10 minutes.`,
      })

      if (!result.success) {
        console.error(`Failed to send OTP SMS to ${recipient}:`, result.error)
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[SMS] OTP for ${recipient}: ${code}`)
        }
        return false
      }

      return true
    }
    
    return false
  } catch (error) {
    console.error(`Error sending OTP to ${recipient}:`, error)
    // Fallback to console log in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${channel.toUpperCase()}] OTP for ${recipient}: ${code}`)
    }
    return false
  }
}

/**
 * Create or update patient account OTP
 */
export async function createPatientOTP(
  practiceId: string,
  patientId: string,
  channel: 'email' | 'sms',
  recipient: string
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateOTP()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Update or create patient account
  const account = await prisma.patientAccount.upsert({
    where: {
      patientId,
    },
    create: {
      practiceId,
      patientId,
      [channel === 'email' ? 'email' : 'phone']: recipient,
      otpCode: await hashOTP(code),
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
    },
    update: {
      [channel === 'email' ? 'email' : 'phone']: recipient,
      otpCode: await hashOTP(code),
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
    },
  })

  // Send OTP
  await sendOTP(practiceId, channel, recipient, code)

  return { code, expiresAt }
}

/**
 * Verify patient OTP
 */
export async function verifyPatientOTP(
  practiceId: string,
  patientId: string,
  code: string
): Promise<boolean> {
  const account = await prisma.patientAccount.findFirst({
    where: {
      patientId,
      practiceId,
    },
  })

  if (!account || !account.otpCode || !account.otpExpiresAt) {
    return false
  }

  // Check expiration
  if (account.otpExpiresAt < new Date()) {
    return false
  }

  // Check attempts
  if (account.otpAttempts >= 5) {
    return false
  }

  // Verify code
  const isValid = await verifyOTP(code, account.otpCode)

  if (!isValid) {
    // Increment attempts
    await prisma.patientAccount.update({
      where: { patientId },
      data: {
        otpAttempts: {
          increment: 1,
        },
      },
    })
    return false
  }

  // Clear OTP and mark as verified
  const updateData: any = {
    otpCode: null,
    otpExpiresAt: null,
    otpAttempts: 0,
    lastLoginAt: new Date(),
  }
  if (account.email) {
    updateData.emailVerified = true
  } else if (account.phone) {
    updateData.phoneVerified = true
  }

  await prisma.patientAccount.update({
    where: { patientId },
    data: updateData,
  })

  return true
}

/**
 * Generate invite token for patient portal access
 */
export async function generateInviteToken(
  practiceId: string,
  patientId: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Ensure patient account exists, then set (rotate) invite token.
  await prisma.patientAccount.upsert({
    where: { patientId },
    create: {
      practiceId,
      patientId,
      inviteToken: token,
      inviteTokenExpiresAt: expiresAt,
    },
    update: {
      inviteToken: token,
      inviteTokenExpiresAt: expiresAt,
    },
  })

  return token
}

/**
 * Verify invite token
 */
export async function verifyInviteToken(
  practiceId: string,
  token: string
): Promise<{ patientId: string } | null> {
  const account = await prisma.patientAccount.findFirst({
    where: {
      practiceId,
      inviteToken: token,
      inviteTokenExpiresAt: {
        gt: new Date(),
      },
    },
  })

  if (!account) {
    return null
  }

  return { patientId: account.patientId }
}

/**
 * Verify invite token without knowing practiceId (token-based fallback).
 */
export async function verifyInviteTokenAnyPractice(token: string): Promise<{ patientId: string; practiceId: string } | null> {
  const account = await prisma.patientAccount.findFirst({
    where: {
      inviteToken: token,
      inviteTokenExpiresAt: {
        gt: new Date(),
      },
    },
    select: {
      patientId: true,
      practiceId: true,
    },
  })

  if (!account) return null
  return { patientId: account.patientId, practiceId: account.practiceId }
}

/**
 * Get or create a fresh verified portal URL for a patient.
 * This rotates the token if missing/expired.
 */
export async function getOrCreateVerifiedPatientPortalUrl(params: {
  practiceId: string
  patientId: string
}): Promise<{ url: string; inviteToken: string; expiresAt: Date }> {
  const existing = await prisma.patientAccount.findFirst({
    where: {
      practiceId: params.practiceId,
      patientId: params.patientId,
    },
    select: {
      inviteToken: true,
      inviteTokenExpiresAt: true,
    },
  })

  const isValid =
    Boolean(existing?.inviteToken) &&
    Boolean(existing?.inviteTokenExpiresAt) &&
    (existing!.inviteTokenExpiresAt as Date) > new Date()

  let inviteToken = existing?.inviteToken || null
  let expiresAt = existing?.inviteTokenExpiresAt || null

  if (!isValid) {
    inviteToken = await generateInviteToken(params.practiceId, params.patientId)
    const refreshed = await prisma.patientAccount.findFirst({
      where: { practiceId: params.practiceId, patientId: params.patientId },
      select: { inviteTokenExpiresAt: true },
    })
    expiresAt = refreshed?.inviteTokenExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }

  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    select: { slug: true },
  })

  const url = buildVerifiedPatientPortalUrl({
    practice: practice ? { slug: practice.slug } : null,
    inviteToken: inviteToken!,
  })

  return { url, inviteToken: inviteToken!, expiresAt: expiresAt as Date }
}
