import crypto from 'crypto'

/** Decode RFC 4648 base32 (no padding required). */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = input.replace(/[\s=-]+/g, '').toUpperCase()
  let bits = ''
  for (const char of cleaned) {
    const val = alphabet.indexOf(char)
    if (val < 0) throw new Error('Invalid base32 TOTP secret')
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

/** Generate a 6-digit TOTP code (SHA1, 30s step). */
export function generateTotp(secretBase32: string, nowMs = Date.now(), stepSeconds = 30): string {
  const key = base32Decode(secretBase32)
  const counter = Math.floor(nowMs / 1000 / stepSeconds)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

/** Seconds remaining in the current TOTP step. */
export function totpSecondsRemaining(nowMs = Date.now(), stepSeconds = 30): number {
  const elapsed = Math.floor(nowMs / 1000) % stepSeconds
  return stepSeconds - elapsed
}

/**
 * Wait until we're safely inside a TOTP window (not the last few seconds),
 * then return a freshly generated code.
 */
export async function generateTotpFresh(
  secretBase32: string,
  opts?: { minRemainingSeconds?: number; stepSeconds?: number }
): Promise<string> {
  const stepSeconds = opts?.stepSeconds ?? 30
  const minRemaining = opts?.minRemainingSeconds ?? 4
  const remaining = totpSecondsRemaining(Date.now(), stepSeconds)
  if (remaining < minRemaining) {
    await new Promise((r) => setTimeout(r, (remaining + 1) * 1000))
  }
  return generateTotp(secretBase32, Date.now(), stepSeconds)
}
