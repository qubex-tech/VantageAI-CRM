import { createPublicKey, verify } from 'crypto'

const DEFAULT_TOLERANCE_SECONDS = 300
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export class TelnyxWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TelnyxWebhookVerificationError'
  }
}

export function getTelnyxWebhookPublicKey(override?: string | null): string | null {
  const fromOverride = override?.trim()
  if (fromOverride) return fromOverride

  const fromEnv = process.env.TELNYX_WEBHOOK_PUBLIC_KEY?.trim()
  return fromEnv || null
}

export function isTelnyxWebhookVerificationRequired(publicKey?: string | null): boolean {
  if (process.env.TELNYX_WEBHOOK_VERIFY === 'false') {
    return false
  }
  return Boolean(getTelnyxWebhookPublicKey(publicKey))
}

export function verifyTelnyxWebhookTimestamp(
  timestamp: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  nowMs = Date.now()
): boolean {
  const parsed = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(parsed)) {
    return false
  }
  const ageSeconds = Math.abs(nowMs / 1000 - parsed)
  return ageSeconds <= toleranceSeconds
}

function ed25519PublicKeyFromBase64(publicKeyBase64: string) {
  const rawKey = Buffer.from(publicKeyBase64, 'base64')
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, rawKey]),
    format: 'der',
    type: 'spki',
  })
}

export function verifyTelnyxWebhookSignature(params: {
  rawBody: string
  signature: string
  timestamp: string
  publicKey: string
  toleranceSeconds?: number
  nowMs?: number
}): boolean {
  const { rawBody, signature, timestamp, publicKey } = params
  const toleranceSeconds = params.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const nowMs = params.nowMs ?? Date.now()

  if (!signature || !timestamp || !publicKey) {
    return false
  }

  if (!verifyTelnyxWebhookTimestamp(timestamp, toleranceSeconds, nowMs)) {
    return false
  }

  let signatureBuffer: Buffer
  try {
    signatureBuffer = Buffer.from(signature, 'base64')
  } catch {
    return false
  }

  if (signatureBuffer.length === 0) {
    return false
  }

  try {
    const signedPayload = `${timestamp}|${rawBody}`
    const publicKeyObject = ed25519PublicKeyFromBase64(publicKey)
    return verify(null, Buffer.from(signedPayload), publicKeyObject, signatureBuffer)
  } catch {
    return false
  }
}

export function assertTelnyxWebhookVerified(params: {
  rawBody: string
  signature: string | null
  timestamp: string | null
  publicKey?: string | null
}): void {
  const publicKey = params.publicKey?.trim() || getTelnyxWebhookPublicKey()
  if (!publicKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        'Telnyx webhook received without configured TELNYX_WEBHOOK_PUBLIC_KEY; signature verification skipped'
      )
    }
    return
  }

  if (!params.signature || !params.timestamp) {
    throw new TelnyxWebhookVerificationError('Missing Telnyx webhook signature headers')
  }

  const valid = verifyTelnyxWebhookSignature({
    rawBody: params.rawBody,
    signature: params.signature,
    timestamp: params.timestamp,
    publicKey,
  })

  if (!valid) {
    throw new TelnyxWebhookVerificationError('Invalid Telnyx webhook signature')
  }
}

export async function resolveTelnyxWebhookPublicKey(): Promise<string | null> {
  const fromEnv = getTelnyxWebhookPublicKey()
  if (fromEnv) return fromEnv

  const { prisma } = await import('@/lib/db')
  const integration = await prisma.telnyxIntegration.findFirst({
    where: {
      isActive: true,
      webhookPublicKey: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: { webhookPublicKey: true },
  })

  return integration?.webhookPublicKey?.trim() || null
}
