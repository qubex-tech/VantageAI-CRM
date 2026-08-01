import { verifyCalSignature } from '@/lib/middleware'

export type CalWebhookSecretCandidate = {
  practiceId: string
  webhookSecret: string
}

/**
 * Match a Cal.com webhook signature to a practice-scoped signing secret.
 * Returns the matching practiceId, or null if none match.
 */
export function matchCalWebhookPractice(
  body: string,
  signature: string,
  candidates: CalWebhookSecretCandidate[]
): string | null {
  if (!body || !signature || candidates.length === 0) {
    return null
  }

  for (const candidate of candidates) {
    const secret = candidate.webhookSecret?.trim()
    if (!secret) continue
    if (verifyCalSignature(body, signature, secret)) {
      return candidate.practiceId
    }
  }

  return null
}
