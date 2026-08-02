import {
  createEmptyRheumPacket,
  finalizeRheumPacket,
  parseTriStateFlag,
  type EligibilityFormMode,
  type EligibilityNetworkStatus,
  type RheumEligibilityPacket,
} from './rheum-packet'

function captureMoney(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return undefined
}

function inferPlanTypeFromText(text: string): string | undefined {
  const lower = text.toLowerCase()
  if (/\bppo\b/.test(lower)) return 'PPO'
  if (/\bhmo\b/.test(lower)) return 'HMO'
  if (/medicare advantage/.test(lower)) return 'Medicare Advantage'
  if (/marketplace|exchange/.test(lower)) return 'Marketplace'
  if (/medicaid/.test(lower)) return 'Medicaid'
  if (/medicare/.test(lower)) return 'Medicare'
  if (/commercial/.test(lower)) return 'Commercial'
  return undefined
}

function inferNetwork(text: string): EligibilityNetworkStatus {
  const lower = text.toLowerCase()
  if (/out[- ]of[- ]network|\bonn\b/.test(lower)) return 'onn'
  if (/in[- ]network|\binn\b/.test(lower)) return 'inn'
  return 'unknown'
}

/**
 * Best-effort scrape of Availity Eligibility & Benefits result text into a rheum packet.
 */
export function scrapeRheumPacketFromPortalText(
  pageText: string,
  opts?: {
    formMode?: EligibilityFormMode
    source?: RheumEligibilityPacket['source']
  }
): RheumEligibilityPacket {
  const formMode = opts?.formMode || 'office_visit'
  const packet = createEmptyRheumPacket(formMode, opts?.source || 'availity_rpa')
  const text = pageText || ''

  packet.planType = inferPlanTypeFromText(text)
  packet.networkStatus = inferNetwork(text)

  const copay = captureMoney(text, [
    /specialist\s*(?:office\s*)?(?:visit\s*)?co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  if (copay) packet.specialistCopay = `$${copay.replace(/,/g, '')}`

  const dedTotal = captureMoney(text, [
    /(?:individual\s+)?deductible\s*(?:total|amount|limit)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /deductible\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  const dedRemaining = captureMoney(text, [
    /(?:deductible\s*)?remaining\s*(?:deductible)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /deductible\s+remaining\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  const dedMet = captureMoney(text, [
    /(?:deductible\s*)?(?:met|ytd|accumulated)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  if (dedTotal || dedRemaining || dedMet) {
    packet.deductible = {
      total: dedTotal ? `$${dedTotal.replace(/,/g, '')}` : undefined,
      remaining: dedRemaining ? `$${dedRemaining.replace(/,/g, '')}` : undefined,
      met: dedMet ? `$${dedMet.replace(/,/g, '')}` : undefined,
    }
  }

  const coins = captureMoney(text, [
    /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*%?/i,
  ])
  if (coins) packet.coinsurance = `${coins.replace(/,/g, '')}%`

  const oopMax = captureMoney(text, [
    /out[- ]of[- ]pocket\s*(?:max(?:imum)?|limit)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /oop\s*(?:max)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  const oopRem = captureMoney(text, [
    /(?:oop|out[- ]of[- ]pocket)\s*remaining\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  if (oopMax || oopRem) {
    packet.oop = {
      max: oopMax ? `$${oopMax.replace(/,/g, '')}` : undefined,
      remaining: oopRem ? `$${oopRem.replace(/,/g, '')}` : undefined,
    }
  }

  packet.referralRequired = parseTriStateFlag(
    text,
    /referral\s*(required|needed|yes)|requires?\s+referral/i,
    /no\s+referral|referral\s*(not required|waived)/i
  )
  packet.authRequired = parseTriStateFlag(
    text,
    /prior\s*auth(orization)?\s*(required|needed|yes)|authorization\s*required/i,
    /no\s+prior\s*auth|prior\s*auth(orization)?\s*(not required|waived)/i
  )
  packet.precertRequired = parseTriStateFlag(
    text,
    /pre-?cert(ification)?\s*(required|needed|yes)/i,
    /no\s+pre-?cert|pre-?cert(ification)?\s*(not required|waived)/i
  )
  packet.telehealthAllowed = parseTriStateFlag(
    text,
    /telehealth\s*(covered|allowed|yes)|telemedicine\s*(covered|allowed)/i,
    /telehealth\s*(not covered|not allowed|no)|telemedicine\s*(not covered)/i
  )

  packet.verifiedBy = 'Availity portal'
  return finalizeRheumPacket(packet)
}
