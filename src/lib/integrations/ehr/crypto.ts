import crypto from 'crypto'

const ENCRYPTION_KEY_ENV = 'INTEGRATIONS_TOKEN_ENC_KEY'

function getKey(): Buffer {
  const raw = process.env[ENCRYPTION_KEY_ENV]
  if (!raw) {
    throw new Error(`${ENCRYPTION_KEY_ENV} is not configured`)
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be 32 bytes (base64)`)
  }
  return key
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + padding, 'base64')
}

type EncryptedEnvelope = {
  v: number
  iv: string
  tag: string
  data: string
}

export function encryptString(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const envelope: EncryptedEnvelope = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }
  return base64UrlEncode(JSON.stringify(envelope))
}

export function decryptString(payload: string): string {
  const decoded = base64UrlDecode(payload).toString('utf8')
  const envelope = JSON.parse(decoded) as EncryptedEnvelope
  if (!envelope || envelope.v !== 1) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = Buffer.from(envelope.iv, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  const data = Buffer.from(envelope.data, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

export function encryptJson(payload: unknown): string {
  return encryptString(JSON.stringify(payload))
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decryptString(payload)) as T
}
