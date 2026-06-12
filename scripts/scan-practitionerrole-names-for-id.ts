/**
 * Run ECW PractitionerRole ?practitioner.name=…&_include=PractitionerRole:practitioner for several
 * name fragments and report if any Practitioner or PractitionerRole references TARGET_PRACTITIONER_ID.
 *
 *   npx tsx --env-file=.env.vercel scripts/scan-practitionerrole-names-for-id.ts [practiceId]
 *
 * Optional env:
 *   TARGET_PRACTITIONER_ID=W6s8...  (default: mystery WcRWBuy8 id)
 *   NAME_QUERIES=Monroe,Bose,Lila,... (comma-separated; script has defaults)
 */
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'

const practiceId = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const targetId =
  process.env.TARGET_PRACTITIONER_ID?.trim() ||
  'W6s8TGka96L4tHbCRoQU8WcRWBuy8GIWV-VrjGM8Exs'

const DEFAULT_QUERIES = [
  'Monroe',
  'Lila',
  'Bose',
  'Nilanjana',
  'Lonestar',
  'Rheumat',
  'Staff',
  'Front',
  'Office',
  'Nurse',
  'MD',
  'PA',
  'NP',
  'Admin',
]

const queries =
  process.env.NAME_QUERIES?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || DEFAULT_QUERIES

function referencesTarget(obj: unknown, needle: string): boolean {
  if (!obj || typeof obj !== 'object') return false
  const s = JSON.stringify(obj)
  return s.includes(needle)
}

;(async () => {
  const ehr = await createEhrClientForPractice(practiceId, { timeoutMs: 120_000 })
  if (!ehr) {
    console.error('no client')
    process.exit(1)
  }
  const { client } = ehr

  const hits: Array<{ query: string; total?: number; matched: boolean; sampleRefs: string[] }> = []

  for (const q of queries) {
    const path = `/PractitionerRole?practitioner.name=${encodeURIComponent(q)}&_include=PractitionerRole:practitioner`
    try {
      const bundle = (await client.request(path)) as Record<string, unknown>
      const entries = (bundle.entry as Array<{ resource?: Record<string, unknown> }> | undefined) || []
      const matched = referencesTarget(bundle, targetId)
      const sampleRefs: string[] = []
      for (const e of entries) {
        const r = e.resource
        if (r?.resourceType === 'Practitioner' && r.id) {
          sampleRefs.push(`Practitioner/${r.id}`)
        }
        if (r?.resourceType === 'PractitionerRole' && r.id) {
          const pr = r.practitioner as { reference?: string } | undefined
          sampleRefs.push(`Role:${r.id} → ${pr?.reference || '?'}`)
        }
      }
      hits.push({
        query: q,
        total: bundle.total as number | undefined,
        matched,
        sampleRefs: sampleRefs.slice(0, 12),
      })
      if (matched) {
        console.log(JSON.stringify({ FOUND: true, query: q, path, bundle }, null, 2))
      }
    } catch (e) {
      hits.push({
        query: q,
        matched: false,
        sampleRefs: [e instanceof Error ? e.message.slice(0, 120) : String(e)],
      })
    }
  }

  const anyFound = hits.some((h) => h.matched)
  console.log(
    JSON.stringify(
      {
        targetId,
        practiceId,
        queriesTried: queries.length,
        anyFound,
        hits: hits.map((h) => ({
          query: h.query,
          total: h.total,
          matched: h.matched,
          sampleRefs: h.sampleRefs,
        })),
      },
      null,
      2
    )
  )

  process.exitCode = anyFound ? 0 : 2
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
