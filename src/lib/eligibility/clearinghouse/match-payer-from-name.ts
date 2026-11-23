import {
  compactPayerText,
  expandPayerNameAliases,
  payerSearchTerms,
  scorePayerLabel,
} from '@/lib/browser-agent/playbooks/availity-eligibility'
import type { PayerSearchResult } from './types'

const SCORE_GAP = 80
const MAX_SEARCH_QUERIES = 4

export type PayerNameMatch =
  | { status: 'matched'; payerId: string; name: string; score: number }
  | { status: 'ambiguous'; candidates: Array<{ payerId: string; name: string; score: number }> }
  | { status: 'none' }

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  return values
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false
      const key = t.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function labelsForHit(hit: PayerSearchResult): string[] {
  return uniqueStrings([hit.name, hit.payerId, ...(hit.aliases || [])])
}

function isDentalPayerLabel(value?: string | null): boolean {
  return /\bdental\b|dentaguard|dentaquest|deltadental|delta dental/i.test(String(value || ''))
}

const TRAILING_EHR_NOISE =
  /\s+(?:inc|llc|ltd|co|corp|corporation|company|incorporated|hmo|ppo|epo|pos)\.?$/i

/**
 * Collapse eCW/Open Dental labels to the brand Stedi actually lists:
 * "Humana HMO", "COMMUNITY HEALTH CHOICED INC" → "Humana" / "Community Health Choice".
 */
export function canonicalPayerName(payerName: string): string {
  let value = String(payerName || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bchoiced\b/gi, 'choice')
    .replace(/\bmedicar\b/gi, 'medicare')
    .replace(/[/|,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  value = value
    .replace(/\s+/g, ' ')
    .replace(/\bhealth\s+care\b/gi, 'Healthcare')
    .replace(/\bof\s+all\s+states\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  for (let i = 0; i < 4; i += 1) {
    const next = value.replace(TRAILING_EHR_NOISE, '').trim()
    if (next === value) break
    value = next
  }
  return value
}

export type PayerProductLine = 'dental' | 'medicaid' | 'supplement' | 'medicare' | 'commercial'

export function payerProductLine(payerName: string): PayerProductLine {
  const compact = compactPayerText(payerName)
  if (/dental|dentaquest|deltadental/.test(compact)) return 'dental'
  if (/medicaid|\bchip\b|starplus|betterhealth/.test(compact)) return 'medicaid'
  if (/supplement|medigap|medsupp/.test(compact)) return 'supplement'
  if (/medicare|advantage|mapd|healthspring/.test(compact)) return 'medicare'
  return 'commercial'
}

function identityCompact(payerName: string): string {
  return compactPayerText(canonicalPayerName(payerName)).replace(/and/g, '')
}

/**
 * Open Dental / eCW labels that Stedi search will not uniquely match.
 * Values are Stedi primary IDs or listed aliases (G84980 is BCBS Texas).
 */
const KNOWN_STEDI_PAYER_BY_COMPACT: Record<string, { payerId: string; name: string }> = {
  dentaquestofillinoisllc: { payerId: 'CX014', name: 'DentaQuest of Illinois' },
  dentaquestofillinois: { payerId: 'CX014', name: 'DentaQuest of Illinois' },
  bluecrossblueshieldoftx: { payerId: 'G84980', name: 'Blue Cross Blue Shield of Texas' },
  bluecrossblueshieldoftexas: { payerId: 'G84980', name: 'Blue Cross Blue Shield of Texas' },
  aetna: { payerId: '60054', name: 'Aetna' },
  aetnamedicareadvantage: { payerId: '60054', name: 'Aetna' },
  humana: { payerId: '61101', name: 'Humana' },
  humanahmo: { payerId: '61101', name: 'Humana' },
  unitedhealthcare: { payerId: '87726', name: 'UnitedHealthcare' },
  unitedhealthcareoftexas: { payerId: '87726', name: 'UnitedHealthcare' },
  aarpunitedhealthcare: { payerId: '87726', name: 'UnitedHealthcare' },
  aarpunitedhealthcaremedicareadvantage: { payerId: '87726', name: 'UnitedHealthcare' },
  uhcmedicarecomplete: { payerId: '87726', name: 'UnitedHealthcare' },
  healthscopeuhc: { payerId: '87726', name: 'UnitedHealthcare' },
  surest: { payerId: '87726', name: 'UnitedHealthcare' },
  surestuhc: { payerId: '87726', name: 'UnitedHealthcare' },
  cigna: { payerId: '81040', name: 'Cigna' },
  cignahealthcare: { payerId: '81040', name: 'Cigna' },
  communityhealthchoice: { payerId: '48145', name: 'Community Health Choice' },
  communityhealthchoiceinc: { payerId: '48145', name: 'Community Health Choice' },
  communityhealthchoicedinc: { payerId: '48145', name: 'Community Health Choice' },
  umr: { payerId: '39026', name: 'UMR' },
  wellmed: { payerId: 'WELM2', name: 'WellMed' },
  wellmedmedicalmanagement: { payerId: 'WELM2', name: 'WellMed' },
  healthspring: { payerId: '63092', name: 'HealthSpring' },
  cignahealthspring: { payerId: '63092', name: 'HealthSpring' },
  healthspringcignamedicare: { payerId: '63092', name: 'HealthSpring' },
  wellpoint: { payerId: 'WLPNT', name: 'Wellpoint' },
  tricare: { payerId: 'TRICE', name: 'TRICARE' },
  tricarewest: { payerId: 'TRICE', name: 'TRICARE' },
  firsthealth: { payerId: '82018', name: 'First Health' },
  firsthealthcurative: { payerId: '82018', name: 'First Health' },
  meritainhealth: { payerId: '41124', name: 'Meritain Health' },
}

function knownLookupKeys(payerName: string): string[] {
  return uniqueStrings([
    compactPayerText(payerName),
    compactPayerText(canonicalPayerName(payerName)),
    identityCompact(payerName),
  ])
}

function lookupKnownPayer(payerName: string): { payerId: string; name: string } | null {
  for (const key of knownLookupKeys(payerName)) {
    const known = KNOWN_STEDI_PAYER_BY_COMPACT[key]
    if (known) return known
  }
  return null
}

export function knownStediPayerIdFromName(
  payerName: string
): { payerId: string; name: string } | null {
  const direct = lookupKnownPayer(payerName)
  if (direct) return direct

  for (const part of payerName.split('/')) {
    if (part.trim() === payerName.trim()) continue
    const fromPart = lookupKnownPayer(part)
    if (fromPart) return fromPart
  }

  for (const inner of payerName.matchAll(/\(([^)]+)\)/g)) {
    const fromParen = lookupKnownPayer(inner[1] || '')
    if (fromParen) return fromParen
  }

  return null
}

export function payerNamesShareStediIdentity(left: string, right: string): boolean {
  if (!left.trim() || !right.trim()) return false
  if (compactPayerText(left) === compactPayerText(right)) return true
  if (identityCompact(left) !== identityCompact(right)) return false
  return payerProductLine(left) === payerProductLine(right)
}

export function inheritPayerIdFromSiblings(
  payerName: string,
  siblings: Array<{ payerNameRaw?: string | null; payerId?: string | null }>
): { payerId: string; name: string } | null {
  const query = payerName.trim()
  if (!query) return null
  for (const sibling of siblings) {
    const payerId = sibling.payerId?.trim()
    const siblingName = sibling.payerNameRaw?.trim()
    if (!payerId || !siblingName) continue
    if (payerNamesShareStediIdentity(query, siblingName)) {
      return { payerId, name: siblingName }
    }
  }
  return null
}

function scoreHit(
  hit: PayerSearchResult,
  payerName: string,
  options?: { preferDental?: boolean }
): number | null {
  const compactQuery = compactPayerText(payerName)
  const compactCanon = compactPayerText(canonicalPayerName(payerName))
  const queryIdentity = identityCompact(payerName)
  let best: number | null = null
  const compactName = compactPayerText(hit.name)
  const compactId = compactPayerText(hit.payerId)
  const hitIdentity = identityCompact(hit.name)

  // Exact display name or payer ID beats shared aliases like AETNA on "Aetna Better Health".
  if (compactQuery.length >= 3 && compactName === compactQuery) {
    best = Math.max(best ?? 0, 20_000)
  }
  if (compactCanon.length >= 3 && compactName === compactCanon) {
    best = Math.max(best ?? 0, 19_500)
  }
  if (queryIdentity.length >= 3 && hitIdentity === queryIdentity) {
    best = Math.max(best ?? 0, 19_000)
  }
  if (compactQuery.length >= 3 && compactId === compactQuery) {
    best = Math.max(best ?? 0, 18_000)
  }

  for (const label of labelsForHit(hit)) {
    const compactLabel = compactPayerText(label)
    if (compactQuery.length >= 3 && compactLabel === compactQuery) {
      const extraProductLine =
        compactName !== compactQuery &&
        compactName.includes(compactQuery) &&
        compactName.length > compactQuery.length + 3
      best = Math.max(best ?? 0, extraProductLine ? 8_000 : 12_000)
    }
    const scored = scorePayerLabel(label, payerName) ?? scorePayerLabel(label, canonicalPayerName(payerName))
    if (scored != null) best = Math.max(best ?? 0, scored)
  }

  if (best == null) return null

  if (options?.preferDental) {
    const dental = isDentalPayerLabel(hit.name) || (hit.aliases || []).some(isDentalPayerLabel)
    best += dental ? 25_000 : -4_000
  } else if (payerProductLine(payerName) !== payerProductLine(hit.name)) {
    best -= 6_000
  }

  return best
}

function pickFromCloseScores(
  scored: Array<{ payerId: string; name: string; score: number }>,
  payerName: string
): PayerNameMatch {
  const queryIdentity = identityCompact(payerName)
  const queryLine = payerProductLine(payerName)
  const sameLine = scored.filter((row) => payerProductLine(row.name) === queryLine)
  const pool = sameLine.length ? sameLine : scored
  const brandHits = pool.filter((row) => {
    const nameIdentity = identityCompact(row.name)
    const compactName = compactPayerText(row.name)
    return nameIdentity === queryIdentity || compactName === queryIdentity
  })

  if (brandHits.length) {
    const exactBrand = brandHits.filter((row) => compactPayerText(row.name) === queryIdentity)
    const preferred = exactBrand.length ? exactBrand : brandHits
    const ids = new Set(preferred.map((row) => row.payerId))
    if (ids.size === 1) {
      return { status: 'matched', ...preferred[0] }
    }
    const shortest = [...preferred].sort((a, b) => a.name.length - b.name.length)
    const shortestIds = new Set(
      shortest.filter((row) => row.name.length === shortest[0].name.length).map((row) => row.payerId)
    )
    if (shortestIds.size === 1) {
      return { status: 'matched', ...shortest[0] }
    }
  }

  if (pool.length === 1) return { status: 'matched', ...pool[0] }
  if (pool.length > 1 && pool[0].score - pool[1].score >= SCORE_GAP) {
    return { status: 'matched', ...pool[0] }
  }
  return { status: 'ambiguous', candidates: pool.slice(0, 4) }
}

export function pickConfidentPayerMatch(
  hits: PayerSearchResult[],
  payerName: string,
  options?: { preferDental?: boolean }
): PayerNameMatch {
  const query = payerName.trim()
  if (!query || hits.length === 0) return { status: 'none' }

  const scored = hits
    .map((hit) => {
      const score = scoreHit(hit, query, options)
      if (score == null) return null
      return { payerId: hit.payerId, name: hit.name || hit.payerId, score }
    })
    .filter((row): row is { payerId: string; name: string; score: number } => Boolean(row))
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { status: 'none' }
  if (scored.length === 1) {
    return { status: 'matched', ...scored[0] }
  }

  const [top, second] = scored
  if (top.score - second.score >= SCORE_GAP) {
    return { status: 'matched', ...top }
  }
  return pickFromCloseScores(scored, query)
}

export function payerNameSearchQueries(
  payerName: string,
  options?: { preferDental?: boolean }
): string[] {
  const raw = payerName.trim()
  if (!raw) return []
  const canonical = canonicalPayerName(raw)
  const firstToken = canonical.split(/[\s/]+/).find(Boolean) || raw
  const dentalQueries = options?.preferDental
    ? [`${firstToken} dental`, `${raw} dental`]
    : []
  const slashParts = raw
    .split('/')
    .map((part) => canonicalPayerName(part))
    .filter((part) => part.length >= 3)
  return uniqueStrings([
    ...dentalQueries,
    raw,
    canonical,
    ...slashParts,
    ...expandPayerNameAliases(raw),
    ...payerSearchTerms(raw).slice(0, 2),
  ]).slice(0, options?.preferDental ? 5 : MAX_SEARCH_QUERIES)
}

export async function resolvePayerIdFromName(params: {
  payerName: string
  searchPayers: (query: string) => Promise<PayerSearchResult[]>
  preferDental?: boolean
  siblingPayers?: Array<{ payerNameRaw?: string | null; payerId?: string | null }>
}): Promise<PayerNameMatch> {
  const known = knownStediPayerIdFromName(params.payerName)
  if (known) {
    return { status: 'matched', payerId: known.payerId, name: known.name, score: 50_000 }
  }

  const inherited = inheritPayerIdFromSiblings(params.payerName, params.siblingPayers || [])
  if (inherited) {
    return { status: 'matched', payerId: inherited.payerId, name: inherited.name, score: 40_000 }
  }

  const options = { preferDental: Boolean(params.preferDental) }
  const queries = payerNameSearchQueries(params.payerName, options)
  if (queries.length === 0) return { status: 'none' }

  const byId = new Map<string, PayerSearchResult>()
  let lastMatch: PayerNameMatch = { status: 'none' }

  for (const query of queries) {
    const hits = await params.searchPayers(query)
    for (const hit of hits) {
      if (!hit.payerId?.trim()) continue
      const existing = byId.get(hit.payerId)
      byId.set(hit.payerId, {
        payerId: hit.payerId,
        name: hit.name || existing?.name || hit.payerId,
        aliases: uniqueStrings([
          ...(existing?.aliases || []),
          ...(hit.aliases || []),
          hit.name,
        ]),
      })
    }

    lastMatch = pickConfidentPayerMatch([...byId.values()], params.payerName, options)
    if (lastMatch.status === 'matched') return lastMatch
  }

  return lastMatch
}
