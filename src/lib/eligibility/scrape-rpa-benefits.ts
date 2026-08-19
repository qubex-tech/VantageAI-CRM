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

function captureText(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim()
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
  // Prefer Health Benefit Plan Coverage insurance-type wording (PPO vs HMO).
  const hbpc = sectionBetween(
    text,
    /health\s+benefit\s+plan\s+coverage/i,
    /benefit information|plan maximums|professional \(physician\)|messages\b|$/i
  )
  const hbpcLower = (hbpc || text).toLowerCase()
  if (/\bppo\b|preferred provider organization/.test(hbpcLower)) return 'PPO'
  if (/\bhmo\b|health maintenance organization/.test(hbpcLower)) return 'HMO'
  if (/\bepo\b|exclusive provider/.test(hbpcLower)) return 'EPO'
  if (/\bpos\b|point of service/.test(hbpcLower)) return 'POS'
  if (/\bppo\b|preferred provider organization/.test(lower)) return 'PPO'
  if (/\bhmo\b|health maintenance organization/.test(lower)) return 'HMO'
  if (/choice\s*plus|unitedhealthcare\s+choice/.test(lower)) return 'Commercial'
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
  // Selected network filter chip / tab copy from Availity results.
  if (
    /(?:^|\n)\s*in[- ]network\s*(?:\n|$)/i.test(text) &&
    !/out[- ](?:of[- ]?)?network\s+benefits|provider is out/i.test(lower)
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

function inferMemberStatus(text: string): string | undefined {
  if (/member\s+status[\s\S]{0,40}active\s+coverage|active\s+coverage/i.test(text)) {
    return 'Active Coverage'
  }
  if (/member\s+status[\s\S]{0,40}inactive|inactive\s+coverage|coverage\s+terminated/i.test(text)) {
    return 'Inactive'
  }
  return undefined
}

function telemedicineBenefitSection(text: string): string {
  // Lonestar televisits: "Telemedicine Specialist Visit,COPAY INCLUDED IN OOP"
  const specific = sectionBetween(
    text,
    /telemedicine\s+specialist\s+visit/i,
    /telemedicine\s|professional\s*\(physician\)|medical care\s*-\s*\d|maximum savings|aetna whole health|health benefit plan coverage|messages\b|$/i
  )
  if (specific.trim().length > 20) return specific

  return sectionBetween(
    text,
    /telemedicine|telehealth\s+specialist|televisit/i,
    /professional\s*\(physician\)|medical care\s*-\s*\d|health benefit plan coverage|messages\b|$/i
  )
}

function officeVisitBenefitSection(text: string): string {
  // Prefer the Lonestar service row, then broader professional office visit blocks.
  const specific = sectionBetween(
    text,
    /professional\s*\(physician\)\s*visit\s*-\s*office\s*-\s*98/i,
    /professional\s*\(physician\)|medical care\s*-\s*\d|telemedicine|health benefit plan coverage|messages\b|$/i
  )
  if (specific.trim().length > 40) return specific

  const office = sectionBetween(
    text,
    /professional\s*\(physician\)\s*visit\s*-\s*office/i,
    /professional\s*\(physician\)|medical care\s*-\s*\d|telemedicine|health benefit plan coverage|messages\b|$/i
  )
  if (office.trim().length > 40) return office

  return sectionBetween(
    text,
    /benefit information/i,
    /plan maximums|health benefit plan coverage|messages\b|$/i
  )
}

function benefitServiceSection(text: string, preferTelemedicine: boolean): string {
  if (preferTelemedicine) {
    const tele = telemedicineBenefitSection(text)
    if (tele.trim().length > 20) return tele
  }
  return officeVisitBenefitSection(text)
}

function scrapeBenefitServiceRows(section: string): {
  copay?: string
  coinsurance?: string
  benefitDeductible?: string
  limitations?: string
  authRequired?: boolean | null
} {
  if (!section.trim()) return {}

  const copay = captureMoney(section, [
    /co-?payment\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /specialist\s*(?:office\s*)?(?:visit\s*)?co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:physician|professional).*?office.*?co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    // Availity benefit grids often put "$40" in the Co-Payment column beside the service row.
    /(?:^|[\n,])\s*[—–-]?\s*\$\s*([\d,]+(?:\.\d{2})?)\s*(?:refer to|—|–|-|\n|$)/i,
  ])
  const coinsurance = captureText(section, [
    /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*%/i,
    /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:percent|%)/i,
  ])
  const benefitDeductible = captureMoney(section, [
    /benefit\s+deductible\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /deductible\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
  ])
  const limitations = captureText(section, [
    /limitations?\s*[:\-]?\s*([^\n]{3,160})/i,
  ])
  const authRequired = parseTriStateFlag(
    section,
    /\bauth(?:orization)?\s*required\b|prior\s*auth(orization)?\s*(required|needed|yes)|authorization\s*[:\-]?\s*(required|yes)/i,
    /no\s+prior\s*auth|prior\s*auth(orization)?\s*(not required|waived)|\bauth(?:orization)?\s*not\s*required\b|authorization\s*[:\-]?\s*(not required|no|n\/a)/i
  )

  return {
    copay: money(copay),
    coinsurance: coinsurance ? `${coinsurance.replace(/,/g, '')}%` : undefined,
    benefitDeductible: money(benefitDeductible),
    limitations:
      limitations && !/^(co-?insurance|co-?payment|authorization|benefit)/i.test(limitations)
        ? limitations
        : undefined,
    authRequired,
  }
}

/**
 * Best-effort scrape of Availity Eligibility & Benefits result text into a rheum packet.
 * Handles labeled fields and Availity Plan Maximums table copy
 * ("$3,200 / Calendar Year(s) … $2,553.13 Remaining"), plus Benefit Information
 * rows for Professional (Physician) Visit - Office - 98 (or Telemedicine Specialist
 * Visit when preferTelemedicine / televisit appointment types).
 */
export function scrapeRheumPacketFromPortalText(
  pageText: string,
  opts?: {
    formMode?: EligibilityFormMode
    source?: RheumEligibilityPacket['source']
    /** When true (televisit / telemedicine appointments), prefer Telemedicine Specialist Visit rows. */
    preferTelemedicine?: boolean
  }
): RheumEligibilityPacket {
  const formMode = opts?.formMode || 'office_visit'
  const preferTelemedicine = Boolean(opts?.preferTelemedicine)
  const packet = createEmptyRheumPacket(formMode, opts?.source || 'availity_rpa')
  const text = pageText || ''

  packet.memberStatus = inferMemberStatus(text)
  packet.planType = inferPlanTypeFromText(text)
  packet.networkStatus = inferNetwork(text)

  const benefitSection = benefitServiceSection(text, preferTelemedicine)
  const benefitRows = scrapeBenefitServiceRows(benefitSection)

  const teleCopay =
    preferTelemedicine
      ? money(
          captureMoney(text, [
            /telemedicine\s+specialist\s+visit[\s\S]{0,240}?\$\s*([\d,]+(?:\.\d{2})?)/i,
            /telemedicine[\s\S]{0,120}?co-?pay(?:ment)?\s*(?:included in oop)?[\s\S]{0,80}?\$\s*([\d,]+(?:\.\d{2})?)/i,
          ])
        )
      : undefined

  const copay =
    teleCopay ||
    benefitRows.copay ||
    money(
      captureMoney(text, [
        /specialist\s*(?:office\s*)?(?:visit\s*)?co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /(?:physician|professional).*?office.*?co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /office\s*visit\s*co-?pay(?:ment)?\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /co-?pay(?:ment)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      ])
    )
  if (copay) packet.specialistCopay = copay

  const planMaxSection = sectionBetween(
    text,
    /plan\s+maximums\s+and\s+deductibles|annual\s+deductible/i,
    /benefit information|messages\b|$/i
  )
  const deductibleSection =
    sectionBetween(text, /annual\s+deductible/i, /out\s*of\s*pocket|benefit information|messages\b|$/i) ||
    planMaxSection
  const dedBucket = pickPrimaryBucket(extractCalendarYearBuckets(deductibleSection))
  const dedTotal =
    dedBucket?.total ||
    captureMoney(text, [
      /(?:individual\s+)?deductible\s*(?:total|amount|limit)?\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /deductible\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
      /individual[^$]{0,80}\$\s*([\d,]+(?:\.\d{2})?)\s*(?:total|\/\s*calendar)/i,
    ]) ||
    (benefitRows.benefitDeductible ? benefitRows.benefitDeductible.replace(/^\$/, '') : undefined)
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
  const coins =
    benefitRows.coinsurance ||
    (() => {
      const raw = captureMoney(text, [
        /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*%/i,
        /co-?insurance\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:percent|%)/i,
      ])
      return raw ? `${raw.replace(/,/g, '')}%` : undefined
    })()
  if (coins) packet.coinsurance = coins

  const oopSection =
    sectionBetween(text, /out\s*of\s*pocket/i, /benefit information|annual\s+deductible|messages\b|$/i) ||
    planMaxSection
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
  const oopMet = oopBucket?.met
  if (oopMax || oopRem || oopMet) {
    packet.oop = {
      max: money(oopMax),
      remaining: money(oopRem),
      met: money(oopMet),
    }
  }

  if (benefitRows.limitations) packet.limitations = benefitRows.limitations

  packet.referralRequired = parseTriStateFlag(
    text,
    /referral\s*(required|needed|yes)|requires?\s+referral/i,
    /no\s+referral|referral\s*(not required|waived)/i
  )
  packet.authRequired =
    benefitRows.authRequired != null
      ? benefitRows.authRequired
      : parseTriStateFlag(
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
  // Presence of a Telemedicine Specialist Visit benefit row implies telehealth is covered.
  if (
    packet.telehealthAllowed == null &&
    (preferTelemedicine || /telemedicine\s+specialist\s+visit/i.test(text))
  ) {
    packet.telehealthAllowed = true
  }

  packet.verifiedBy = 'Availity portal'
  return finalizeRheumPacket(packet)
}
