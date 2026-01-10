// SMS rendering utilities

import { BrandProfile, VariableContext } from './types'
import { replaceVariables } from './variables'

/**
 * Render SMS text with compliance injection
 */
export function renderSmsText(
  templateText: string,
  brandProfile: BrandProfile | null,
  context: VariableContext
): string {
  // Replace variables in template
  let finalText = replaceVariables(templateText, context)
  
  // Auto-inject practice name prefix if missing
  const practiceName = context.practice?.name || brandProfile?.practiceName || ''
  if (practiceName && !finalText.toLowerCase().includes(practiceName.toLowerCase())) {
    finalText = `${practiceName}: ${finalText}`
  }
  
  // Append footer if configured (avoid duplicates)
  const footerText = brandProfile?.smsFooterText
  if (footerText && !finalText.includes(footerText)) {
    finalText = `${finalText}\n\n${footerText}`
  }
  
  return finalText.trim()
}

/**
 * Estimate SMS segments (GSM-7 vs Unicode approximation)
 * Simple heuristic: GSM-7 = 160 chars, Unicode = 70 chars
 */
export function estimateSmsSegments(text: string): { segments: number; encoding: 'GSM-7' | 'Unicode'; chars: number } {
  const chars = text.length
  
  // Simple check: if text contains non-GSM-7 characters, assume Unicode
  const gsm7Pattern = /^[\x00-\x7F]*$/
  const hasUnicode = !gsm7Pattern.test(text) || /[^\x20-\x7E\x09\x0A\x0D]/.test(text)
  
  const encoding = hasUnicode ? 'Unicode' : 'GSM-7'
  const charsPerSegment = hasUnicode ? 70 : 160
  
  // Account for concatenation (messages over 1 segment need 6 extra chars for UDH)
  let segments = 1
  let remaining = chars
  
  while (remaining > charsPerSegment) {
    segments++
    remaining -= charsPerSegment
    if (segments > 1) {
      remaining -= 6 // UDH overhead for concatenated messages
    }
  }
  
  return { segments, encoding, chars }
}

/**
 * Get character count and segment estimation for SMS
 */
export function getSmsStats(text: string): {
  characterCount: number
  segments: number
  encoding: 'GSM-7' | 'Unicode'
  costEstimate?: string // Optional: can integrate with provider pricing
} {
  const { segments, encoding, chars } = estimateSmsSegments(text)
  
  return {
    characterCount: chars,
    segments,
    encoding,
  }
}
