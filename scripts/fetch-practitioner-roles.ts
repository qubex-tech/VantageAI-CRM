/**
 * GET PractitionerRole bundle via ecw_write backend (tries eCW-tolerant URL shapes).
 *
 *   node --env-file=.env --import tsx scripts/fetch-practitioner-roles.ts [practiceId] [refOrRawId]
 */
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'

function normalizePractitionerRef(input: string): string {
  const t = input.trim()
  if (t.startsWith('Practitioner/')) return t
  return `Practitioner/${t}`
}

function entryMatchesPractitioner(
  entry: { resource?: { practitioner?: { reference?: string } } },
  practitioner: string
): boolean {
  const ref = entry.resource?.practitioner?.reference?.trim()
  if (!ref) return false
  if (ref === practitioner) return true
  const id = practitioner.replace(/^Practitioner\//, '')
  return ref === id || ref === `Practitioner/${id}`
}

async function main() {
  const practiceId = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
  const refInput = process.argv[3] || 'W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'
  const practitioner = normalizePractitionerRef(refInput)
  const idOnly = practitioner.replace(/^Practitioner\//, '')

  const ctx = await createEhrClientForPractice(practiceId, { timeoutMs: 120_000 })
  if (!ctx) {
    console.log(JSON.stringify({ ok: false, error: 'no ecw_write backend connection' }))
    process.exit(1)
  }

  const paths = [
    `/PractitionerRole?practitioner=${practitioner}`,
    `/PractitionerRole?practitioner=${idOnly}`,
    `/PractitionerRole?actor=${practitioner}`,
    `/PractitionerRole?_count=50`,
    `/PractitionerRole`,
  ]

  type Attempt = {
    path: string
    ok: boolean
    entryCount?: number
    error?: string
  }
  const attempts: Attempt[] = []
  let bestBundle: unknown
  let bestPath = ''
  let bestScore = -1

  for (const path of paths) {
    try {
      const b = (await ctx.client.request(path)) as { entry?: unknown[] }
      const entries = Array.isArray(b.entry) ? b.entry : []
      const matching = entries.filter((e) =>
        entryMatchesPractitioner(e as { resource?: { practitioner?: { reference?: string } } }, practitioner)
      )
      const score = matching.length > 0 ? matching.length + 1000 : entries.length
      attempts.push({ path, ok: true, entryCount: entries.length })
      if (score > bestScore) {
        bestScore = score
        bestBundle = b
        bestPath = path
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      attempts.push({ path, ok: false, error: msg.slice(0, 400) })
    }
  }

  if (!bestBundle) {
    console.log(JSON.stringify({ ok: false, attempts }, null, 2))
    process.exit(1)
  }

  const b = bestBundle as {
    resourceType?: string
    type?: string
    total?: number
    entry?: Array<{
      resource?: {
        id?: string
        resourceType?: string
        practitioner?: unknown
        organization?: unknown
        location?: unknown
        code?: unknown
      }
    }>
  }
  const allEntries = b.entry || []
  const forPractitioner = allEntries.filter((e) =>
    entryMatchesPractitioner(e as { resource?: { practitioner?: { reference?: string } } }, practitioner)
  )
  const slice = forPractitioner.length > 0 ? forPractitioner : allEntries

  const summary = {
    ok: true,
    chosenPath: bestPath,
    attempts,
    resourceType: b.resourceType,
    bundleType: b.type,
    total: b.total,
    entryCountAll: allEntries.length,
    entryCountForPractitioner: forPractitioner.length,
    roleIdsForPractitioner: slice.map((e) => e.resource?.id).filter(Boolean),
  }

  const filteredBundle = {
    ...b,
    entry: slice,
  }

  console.log(JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(filteredBundle, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
