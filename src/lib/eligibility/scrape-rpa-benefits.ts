import {
  createEmptyRheumPacket,
  finalizeRheumPacket,
  parseTriStateFlag,
  type EligibilityFormMode,
  type EligibilityNetworkStatus,
  type RheumEligibilityPacket,
} from './rheum-packet'

function money(value: string | undefined): string | undefined {
  if (!value) return undefined
  return `$${value.replace(/,/g, '')}`
}

function captureMoney(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return undefined
}

/** Prefer Individual column amounts from Availity Plan Maximums tables. */
function captureIndividualSectionMoney(
  text: string,
  sectionPattern: RegExp,
  amountPatterns: RegExp[]
): string | undefined {
  const section = text.match(sectionPattern)?.[0]
  if (!section) return captureMoney(text, amountPatterns)
  return captureMoney(section, amountPatterns)
}

function inferPlanTypeFromText(text: string): string | undefined {
  const lower = text.toLowerCase()
  if (/choice\s*plus|unitedhealthcare\s+choice/.test(lower)) return 'Commercial'
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
  // Availity often states provider network explicitly even when the INN filter is selected.
  if (
    /provider is out[- ](?:of[- ]?)?network|out[- ](?:of[- ]?)?network for member|\bonn\b|non[- ]participating/.test(
      lower
    )
  ) {
    return 'onn'
  }
  if (
    /provider is in[- ](?:of[- ]?)?network|in[- ](?:of[- ]?)?network for member|\binn\b|participating provider/.test(
      lower
    )
  ) {
    return 'inn'
  }
  // Prefer explicit benefit-network phrasing over filter chip labels like "(In-Network)".
  if (/in[- ](?:of[- ]?)?network\s+benefits|\bin[- ]network\b(?!\s*\))/.test(lower) && !/out[- ](?:of[- ]?)?network/.test(lower)) {
    return 'inn'
  }
  if (/out[- ](?:of[- ]?)?network\s+benefits|\bout[- ]of[- ]network\b(?!\s*\))/.test(lower)) {
    return 'onn'
  }
  return 'unknown'
}

/**
 * Best-effort scrape of Availity Eligibility & Benefits result text into a rheum packet.
 * Handles both simple labeled fields and Availity "Plan Maximums and Deductibles" copy.
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
    /office\s*visit\s*co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /co-?pay(?:ment)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  if (copay) packet.specialistCopay = money(copay)

  // Availity Plan Maximums: "Annual Deductible ... Individual: $3,200 ... $2,553.13 is remaining"
  const deductibleSection =
    /annual\s+deductible[\s\S]{0,900}?(?=out\s*of\s*pocket|highest\s+benefit|co-?insurance|specialist|messages\b|$)/i
  const dedTotal =
    captureIndividualSectionMoney(text, deductibleSection, [
      /individual[^$]{0,80}\$\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:individual\s+)?deductible[^$]{0,40}\$\s*([\d,]+(?:\.\d{2})?)/i,
      /deductible\s*(?:total|amount|limit)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
    ]) ||
    captureMoney(text, [
      /(?:individual\s+)?deductible\s*(?:total|amount|limit)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /deductible\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
    ])

  const dedRemaining =
    captureIndividualSectionMoney(text, deductibleSection, [
      /\$\s*([\d,]+(?:\.\d{2})?)\s+is\s+remaining/i,
      /remaining[^$]{0,20}\$\s*([\d,]+(?:\.\d{2})?)/i,
      /deductible\s+remaining\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
    ]) ||
    captureMoney(text, [
      /deductible\s+remaining\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /\$\s*([\d,]+(?:\.\d{2})?)\s+is\s+remaining/i,
    ])

  const dedMet =
    captureIndividualSectionMoney(text, deductibleSection, [
      /\$\s*([\d,]+(?:\.\d{2})?)\s+has\s+been\s+applied/i,
      /(?:met|ytd|accumulated)[^$]{0,20}\$\s*([\d,]+(?:\.\d{2})?)/i,
    ]) ||
    captureMoney(text, [
      /(?:deductible\s*)?(?:met|ytd|accumulated)\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
    ])

  if (dedTotal || dedRemaining || dedMet) {
    packet.deductible = {
      total: money(dedTotal),
      remaining: money(dedRemaining),
      met: money(dedMet),
    }
  }

  const coins = captureMoney(text, [
    /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*%/i,
    /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:percent|%)/i,
  ])
  if (coins) packet.coinsurance = `${coins.replace(/,/g, '')}%`

  const oopSection =
    /out[- ]of[- ]pocket[\s\S]{0,900}?(?=annual\s+deductible|highest\s+benefit|co-?insurance|specialist|messages\b|$)/i
  const oopMax =
    captureIndividualSectionMoney(text, oopSection, [
      /individual[^$]{0,80}\$\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:max(?:imum)?|limit)[^$]{0,20}\$\s*([\d,]+(?:\.\d{2})?)/i,
    ]) ||
    captureMoney(text, [
      /out[- ]of[- ]pocket\s*(?:max(?:imum)?|limit)\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /oop\s*(?:max)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
    ])
  const oopRem =
    captureIndividualSectionMoney(text, oopSection, [
      /\$\s*([\d,]+(?:\.\d{2})?)\s+is\s+remaining/i,
      /remaining[^$]{0,20}\$\s*([\d,]+(?:\.\d{2})?)/i,
    ]) ||
    captureMoney(text, [
      /(?:oop|out[- ]of[- ]pocket)\s*remaining\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
    ])
  if (oopMax || oopRem) {
    packet.oop = {
      max: money(oopMax),
      remaining: money(oopRem),
    }
  }

  packet.referralRequired = parseTriStateFlag(
    text,
    /referral\s*(required|needed|yes)|requires?\s+referral/i,
    /no\s+referral|referral\s*(not required|waived)/i
  )
  packet.authRequired = parseTriStateFlag(
    text,
    /\bauth(?:orization)?\s*required\b|prior\s*auth(orization)?\s*(required|needed|yes)|prior\s+authorization\s+or\s+notification/i,
    /no\s+prior\s*auth|prior\s*auth(orization)?\s*(not required|waived)|\bauth(?:orization)?\s*not\s*required\b/i
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
