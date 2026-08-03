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

function parseAmount(value: string | undefined): number {
  if (!value) return NaN
  return Number(value.replace(/,/g, ''))
}

function captureMoney(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return undefined
}

type CalendarBucket = { total?: string; met?: string; remaining?: string }

/**
 * Availity Plan Maximums rows look like:
 *   $3,200 / Calendar Year(s)
 *   -$646.87 Year to Date
 *   $2,553.13 Remaining
 */
function extractCalendarYearBuckets(section: string): CalendarBucket[] {
  const buckets: CalendarBucket[] = []
  const re =
    /\$\s*([\d,]+(?:\.\d{2})?)\s*\/\s*Calendar Year[\s\S]{0,160}?-\$?\s*([\d,]+(?:\.\d{2})?)\s*Year to Date[\s\S]{0,160}?\$\s*([\d,]+(?:\.\d{2})?)\s*Remaining/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(section))) {
    buckets.push({ total: m[1], met: m[2], remaining: m[3] })
  }
  return buckets
}

/** Prefer first non-zero Individual-style bucket (skip Availity "HIGHEST BENEFIT" $0 rows). */
function pickPrimaryBucket(buckets: CalendarBucket[]): CalendarBucket | undefined {
  const nonZero = buckets.filter((b) => parseAmount(b.total) > 0)
  return nonZero[0] || buckets[0]
}

function sectionBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = text.search(start)
  if (startMatch < 0) return ''
  const from = text.slice(startMatch)
  const endMatch = from.search(end)
  return endMatch > 0 ? from.slice(0, endMatch) : from.slice(0, 4000)
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
  if (
    /in[- ](?:of[- ]?)?network\s+benefits|\bin[- ]network\b(?!\s*\))/.test(lower) &&
    !/out[- ](?:of[- ]?)?network/.test(lower)
  ) {
    return 'inn'
  }
  if (/out[- ](?:of[- ]?)?network\s+benefits|\bout[- ]of[- ]network\b(?!\s*\))/.test(lower)) {
    return 'onn'
  }
  return 'unknown'
}

/**
 * Best-effort scrape of Availity Eligibility & Benefits result text into a rheum packet.
 * Handles labeled fields and Availity Plan Maximums table copy
 * ("$3,200 / Calendar Year(s) … $2,553.13 Remaining").
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
    /(?:physician|professional).*?office.*?co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /office\s*visit\s*co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /co-?pay(?:ment)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  if (copay) packet.specialistCopay = money(copay)

  const deductibleSection = sectionBetween(
    text,
    /annual\s+deductible/i,
    /out\s*of\s*pocket|benefit information|messages\b|$/i
  )
  const dedBucket = pickPrimaryBucket(extractCalendarYearBuckets(deductibleSection))
  const dedTotal =
    dedBucket?.total ||
    captureMoney(text, [
      /(?:individual\s+)?deductible\s*(?:total|amount|limit)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /deductible\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /individual[^$]{0,80}\$\s*([\d,]+(?:\.\d{2})?)\s*(?:total|\/\s*calendar)/i,
    ])
  const dedRemaining =
    dedBucket?.remaining ||
    captureMoney(text, [
      /deductible\s+remaining\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /\$\s*([\d,]+(?:\.\d{2})?)\s+is\s+remaining/i,
      /\$\s*([\d,]+(?:\.\d{2})?)\s+remaining/i,
    ])
  const dedMet =
    dedBucket?.met ||
    captureMoney(deductibleSection || text, [
      /\$\s*([\d,]+(?:\.\d{2})?)\s+has\s+been\s+applied/i,
      /(?:deductible\s*)?(?:met|ytd|accumulated)\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /-\$?\s*([\d,]+(?:\.\d{2})?)\s*year to date/i,
    ])

  if (dedTotal || dedRemaining || dedMet) {
    packet.deductible = {
      total: money(dedTotal),
      remaining: money(dedRemaining),
      met: money(dedMet),
    }
  }

  // Only accept explicit percent coinsurance labels — Availity progress bars ("20%") are not coinsurance.
  const coins = captureMoney(text, [
    /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*%/i,
    /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:percent|%)/i,
  ])
  if (coins) packet.coinsurance = `${coins.replace(/,/g, '')}%`

  const oopSection = sectionBetween(
    text,
    /out\s*of\s*pocket/i,
    /benefit information|annual\s+deductible|messages\b|$/i
  )
  const oopBucket = pickPrimaryBucket(extractCalendarYearBuckets(oopSection))
  const oopMax =
    oopBucket?.total ||
    captureMoney(oopSection || text, [
      /individual[^$]{0,80}\$\s*([\d,]+(?:\.\d{2})?)/i,
      /out[- ]of[- ]pocket\s*(?:max(?:imum)?|limit)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /oop\s*(?:max)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
    ])
  const oopRem =
    oopBucket?.remaining ||
    captureMoney(oopSection || text, [
      /\$\s*([\d,]+(?:\.\d{2})?)\s+is\s+remaining/i,
      /\$\s*([\d,]+(?:\.\d{2})?)\s+remaining/i,
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
