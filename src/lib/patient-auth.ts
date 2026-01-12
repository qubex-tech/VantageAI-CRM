import { prisma } from './db'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

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
 * This is a placeholder - integrate with SendGrid/Twilio
 */
export async function sendOTP(
  practiceId: string,
  channel: 'email' | 'sms',
  recipient: string,
  code: string
): Promise<boolean> {
  // TODO: Integrate with SendGrid (email) and Twilio (SMS)
  // For now, log the OTP (in production, this should send actual messages)
  console.log(`[${channel.toUpperCase()}] OTP for ${recipient}: ${code}`)
  return true
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

  await prisma.patientAccount.update({
    where: { patientId },
    data: {
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
