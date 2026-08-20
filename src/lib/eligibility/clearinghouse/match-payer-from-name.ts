import {
  compactPayerText,
  expandPayerNameAliases,
  payerSearchTerms,
  scorePayerLabel,
} from '@/lib/browser-agent/playbooks/availity-eligibility'
import type { PayerSearchResult } from './types'

const SCORE_GAP = 80
const MAX_SEARCH_QUERIES = 3

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

function scoreHit(hit: PayerSearchResult, payerName: string): number | null {
  const compactQuery = compactPayerText(payerName)
  let best: number | null = null
  const compactName = compactPayerText(hit.name)
  const compactId = compactPayerText(hit.payerId)

  // Exact display name or payer ID beats shared aliases like AETNA on "Aetna Better Health".
  if (compactQuery.length >= 3 && compactName === compactQuery) {
    best = Math.max(best ?? 0, 20_000)
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
    const scored = scorePayerLabel(label, payerName)
    if (scored != null) best = Math.max(best ?? 0, scored)
  }

  return best
}

export function pickConfidentPayerMatch(
  hits: PayerSearchResult[],
  payerName: string
): PayerNameMatch {
  const query = payerName.trim()
  if (!query || hits.length === 0) return { status: 'none' }

  const scored = hits
    .map((hit) => {
      const score = scoreHit(hit, query)
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
  if (top.score - second.score < SCORE_GAP) {
    return { status: 'ambiguous', candidates: scored.slice(0, 4) }
  }
  return { status: 'matched', ...top }
}

export function payerNameSearchQueries(payerName: string): string[] {
  const raw = payerName.trim()
  if (!raw) return []
  return uniqueStrings([
    raw,
    ...expandPayerNameAliases(raw),
    ...payerSearchTerms(raw).slice(0, 2),
  ]).slice(0, MAX_SEARCH_QUERIES)
}

export async function resolvePayerIdFromName(params: {
  payerName: string
  searchPayers: (query: string) => Promise<PayerSearchResult[]>
}): Promise<PayerNameMatch> {
  const queries = payerNameSearchQueries(params.payerName)
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

    lastMatch = pickConfidentPayerMatch([...byId.values()], params.payerName)
    if (lastMatch.status === 'matched') return lastMatch
  }

  return lastMatch
}
