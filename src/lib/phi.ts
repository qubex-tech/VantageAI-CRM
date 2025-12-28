/**
 * PHI (Protected Health Information) Redaction Utilities
 * 
 * These helpers redact sensitive patient data from logs and transcripts
 * to help with HIPAA compliance. In production, consider more sophisticated
 * redaction libraries and audit logging of redacted content.
 */

const PHONE_REGEX = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
const SSN_REGEX = /\b\d{3}-?\d{2}-?\d{4}\b/g
const MRN_REGEX = /\bMRN\s*:?\s*\d+\b/gi

/**
 * Redact phone numbers from text
 */
export function redactPhone(text: string): string {
  return text.replace(PHONE_REGEX, '[PHONE_REDACTED]')
}

/**
 * Redact email addresses from text
 */
export function redactEmail(text: string): string {
  return text.replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
}

/**
 * Redact SSNs from text
 */
export function redactSSN(text: string): string {
  return text.replace(SSN_REGEX, '[SSN_REDACTED]')
}

/**
 * Redact MRNs from text
 */
export function redactMRN(text: string): string {
  return text.replace(MRN_REGEX, '[MRN_REDACTED]')
}

/**
 * Redact all PHI from text
 */
export function redactPHI(text: string | null | undefined): string {
  if (!text) return ''
  
  let redacted = text
  redacted = redactPhone(redacted)
  redacted = redactEmail(redacted)
  redacted = redactSSN(redacted)
  redacted = redactMRN(redacted)
  
  return redacted
}

/**
 * Redact PHI from an object (recursive)
 */
export function redactPHIFromObject<T extends Record<string, any>>(
  obj: T,
  fieldsToRedact: string[] = ['phone', 'email', 'ssn', 'mrn', 'address']
): Partial<T> {
  const redacted = { ...obj }
  
  for (const key in redacted) {
    if (fieldsToRedact.includes(key.toLowerCase())) {
      if (typeof redacted[key] === 'string' && redacted[key]) {
        redacted[key] = redactPHI(redacted[key]) as any
      }
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactPHIFromObject(redacted[key], fieldsToRedact) as any
    }
  }
  
  return redacted
}

/**
 * Safe stringify for logging (redacts PHI)
 */
export function safeStringify(obj: any): string {
  try {
    const redacted = redactPHIFromObject(obj)
    return JSON.stringify(redacted, null, 2)
  } catch (error) {
    return '[Error stringifying object]'
  }
}

