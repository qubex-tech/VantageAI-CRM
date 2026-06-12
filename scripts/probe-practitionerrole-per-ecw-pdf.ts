/**
 * Resolve details via eCW **PractitionerRole** read API (US Core / ECW PDF):
 * - GET /PractitionerRole/{id}
 * - GET /PractitionerRole?practitioner={id} and Practitioner/{id}
 * - GET /PractitionerRole?practitioner.identifier=http://hl7.org/fhir/sid/us-npi|{npi}&_include=PractitionerRole:practitioner
 * - GET /PractitionerRole?practitioner.name={q}&_include=PractitionerRole:practitioner
 *
 *   npx tsx --env-file=.env.vercel scripts/probe-practitionerrole-per-ecw-pdf.ts [practiceId] [practitionerOrRoleId]
 *
 * Optional:
 *   PRACTITIONER_NPI=1234567890  (tries PDF chained identifier search)
 *   PRACTITIONER_NAME_QUERY=Bose (tries PDF chained name search + include)
 */
import fs from 'fs'
import path from 'path'
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'

const practiceId = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const rawId =
  process.argv[3] || 'W6s8TGka96L4tHbCRoQU8WcRWBuy8GIWV-VrjGM8Exs'

const NPI_SYSTEM = 'http://hl7.org/fhir/sid/us-npi'

type Attempt = { path: string; ok: boolean; error?: string; summary?: unknown; raw?: unknown }

function bundleSummary(body: Record<string, unknown>) {
  const entries = (body.entry as Array<{ resource?: Record<string, unknown> }> | undefined) || []
  const byType: Record<string, number> = {}
  const roles: string[] = []
  const practitioners: string[] = []
  for (const e of entries) {
    const r = e.resource
    const t = (r?.resourceType as string) || '?'
    byType[t] = (byType[t] || 0) + 1
    if (t === 'PractitionerRole' && r?.id) roles.push(String(r.id))
    if (t === 'Practitioner' && r?.id) practitioners.push(String(r.id))
  }
  return {
    total: body.total,
    entryCount: entries.length,
    resourceTypes: byType,
    practitionerRoleIds: roles.slice(0, 20),
    practitionerIds: practitioners.slice(0, 20),
  }
}

;(async () => {
  const ehr = await createEhrClientForPractice(practiceId, { timeoutMs: 120_000 })
  if (!ehr) {
    console.error('no client')
    process.exit(1)
  }
  const { client } = ehr
  const idEnc = encodeURIComponent(rawId)

  const paths: string[] = [
    `/PractitionerRole/${idEnc}`,
    `/PractitionerRole?practitioner=${idEnc}`,
    `/PractitionerRole?practitioner=${encodeURIComponent(`Practitioner/${rawId}`)}`,
  ]

  const npi = process.env.PRACTITIONER_NPI?.replace(/\D/g, '')
  if (npi) {
    const idParam = encodeURIComponent(`${NPI_SYSTEM}|${npi}`)
    paths.push(
      `/PractitionerRole?practitioner.identifier=${idParam}&_include=PractitionerRole:practitioner`
    )
  }

  const nameQ = process.env.PRACTITIONER_NAME_QUERY?.trim()
  if (nameQ) {
    paths.push(
      `/PractitionerRole?practitioner.name=${encodeURIComponent(nameQ)}&_include=PractitionerRole:practitioner`
    )
  }

  const attempts: Attempt[] = []

  for (const p of paths) {
    const row: Attempt = { path: p, ok: false }
    try {
      const res = (await client.request(p)) as Record<string, unknown>
      row.raw = res
      if (res.resourceType === 'PractitionerRole') {
        row.ok = true
        row.summary = {
          kind: 'single',
          id: res.id,
          practitioner: res.practitioner,
          organization: res.organization,
          code: res.code,
          specialty: res.specialty,
          location: res.location,
          telecom: res.telecom,
          identifier: res.identifier,
        }
      } else if (res.resourceType === 'Bundle') {
        const n = (res.entry as unknown[] | undefined)?.length ?? 0
        row.summary = { kind: 'bundle', ...bundleSummary(res) }
        row.ok = n > 0
      }
      attempts.push(row)
    } catch (e) {
      row.error = e instanceof Error ? e.message : String(e)
      attempts.push(row)
    }
  }

  const firstHit = attempts.find((a) => a.ok)
  const out = {
    generatedAt: new Date().toISOString(),
    practiceId,
    queriedId: rawId,
    npiTried: npi || null,
    nameQueryTried: nameQ || null,
    firstSuccessfulAttemptPath: firstHit?.path ?? null,
    attempts: attempts.map((a) => ({
      path: a.path,
      ok: a.ok,
      error: a.error ? a.error.split('\n')[0].slice(0, 300) : undefined,
      summary: a.summary,
    })),
    /** Full payload only for the first success (avoid huge logs). */
    firstSuccessPayload: firstHit?.raw ?? null,
  }

  const outDir = path.join(process.cwd(), 'scripts', 'output', 'telephone-encounter-lila')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `practitionerrole-endpoint-${Date.now()}.json`)
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))

  console.log(JSON.stringify({ wrote: outFile, ...out }, null, 2))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
