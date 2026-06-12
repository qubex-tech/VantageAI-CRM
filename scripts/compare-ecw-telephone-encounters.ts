/**
 * Fetch multiple eCW Encounters by FHIR id and print a normalized comparison
 * (status, class, participant vs assignedTo extension, all extension URLs, period, etc.).
 *
 * Use this to compare **API-created** telephone encounters (ids from scenario script output)
 * with **one you create manually** in eCW for the same patient: paste the manual encounter’s
 * FHIR Encounter id if you have it, or discover id via ECW tools/support.
 *
 *   npx tsx --env-file=.env.vercel scripts/compare-ecw-telephone-encounters.ts [practiceId] [id1] [id2] ...
 *
 * Or:
 *   ENCOUNTER_IDS='apiId,manualId' ENCOUNTER_LABELS='scenario_01,manual_ui' npx tsx --env-file=.env.vercel scripts/compare-ecw-telephone-encounters.ts
 *
 * `ENCOUNTER_LABELS` is optional comma-separated labels (same length as ids). You can also set
 * `ENCOUNTER_LABEL_1`, `ENCOUNTER_LABEL_2`, ...
 *
 * Writes: scripts/output/telephone-encounter-lila/comparison-<timestamp>.json
 */
import fs from 'fs'
import path from 'path'
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'

const DEFAULT_PRACTICE_ID = '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const PRACTICE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Default: example scenario ids — override with ENCOUNTER_IDS or CLI. */
const DEFAULT_SCENARIO_IDS = [
  'W6s8TGka96L4tHbCRoQU8RT-05RwO3K0768eSevLrJeH..Trd6iOfL1nnpqeitou',
  'W6s8TGka96L4tHbCRoQU8RT-05RwO3K0768eSevLrJcLKHZAlGo2S-IksmrSBJrG',
  'W6s8TGka96L4tHbCRoQU8RT-05RwO3K0768eSevLrJfVDrrz2a5rNLHGvsxIhyzf',
]

function parsePracticeAndEncounterIds(): { practiceId: string; encounterIds: string[] } {
  const fromEnv = process.env.ENCOUNTER_IDS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv?.length) {
    return {
      practiceId: process.env.PRACTICE_ID?.trim() || DEFAULT_PRACTICE_ID,
      encounterIds: fromEnv,
    }
  }

  const args = process.argv.slice(2).map((s) => s.trim()).filter(Boolean)
  let practiceId = process.env.PRACTICE_ID?.trim() || DEFAULT_PRACTICE_ID
  let idArgs = args
  if (args[0] && PRACTICE_UUID_RE.test(args[0])) {
    practiceId = args[0]
    idArgs = args.slice(1)
  }
  if (idArgs.length > 0) {
    return { practiceId, encounterIds: idArgs }
  }
  return { practiceId, encounterIds: DEFAULT_SCENARIO_IDS }
}

type Normalized = {
  label: string
  id: string
  subject?: string
  status?: unknown
  class?: unknown
  type?: unknown
  period?: unknown
  participantRefs: string[]
  serviceProvider?: string
  locationRefs: string[]
  extensionUrls: string[]
  assignedToRef: string | null
  messagesLen: number
  notesLen: number
  pharmacyPresent: boolean
  participantMatchesAssignedTo: boolean
  error?: string
}

function normalizeEncounter(label: string, enc: Record<string, unknown> | null, err?: string): Normalized {
  if (err || !enc || enc.resourceType !== 'Encounter') {
    return {
      label,
      id: (enc?.id as string) || '?',
      participantRefs: [],
      extensionUrls: [],
      assignedToRef: null,
      messagesLen: 0,
      notesLen: 0,
      pharmacyPresent: false,
      participantMatchesAssignedTo: false,
      error: err || 'not an Encounter',
    }
  }

  const exts = (enc.extension as Array<{ url?: string; valueString?: string; valueReference?: { reference?: string } }>) || []
  const urls = [...new Set(exts.map((e) => e.url).filter(Boolean) as string[])].sort()
  const assignedToRef =
    exts.find((e) => e.url?.endsWith('telephoneEncounter/assignedTo'))?.valueReference?.reference || null
  const messages = exts.find((e) => e.url?.endsWith('telephoneEncounter/messages'))?.valueString || ''
  const notes = exts.find((e) => e.url?.endsWith('telephoneEncounter/notes'))?.valueString || ''
  const pharmacyPresent = exts.some((e) => e.url?.endsWith('telephoneEncounter/pharmacy'))

  const participants = (enc.participant as Array<{ individual?: { reference?: string } }> | undefined) || []
  const participantRefs = participants.map((p) => p.individual?.reference).filter(Boolean) as string[]
  const primaryPart = participantRefs[0] || null

  return {
    label,
    id: String(enc.id),
    subject: (enc.subject as { reference?: string } | undefined)?.reference,
    status: enc.status,
    class: enc.class,
    type: enc.type,
    period: enc.period,
    participantRefs,
    serviceProvider: (enc.serviceProvider as { reference?: string } | undefined)?.reference,
    locationRefs: ((enc.location as Array<{ location?: { reference?: string } }> | undefined) || []).map(
      (l) => l.location?.reference
    ).filter(Boolean) as string[],
    extensionUrls: urls,
    assignedToRef,
    messagesLen: messages.length,
    notesLen: notes.length,
    pharmacyPresent,
    participantMatchesAssignedTo: Boolean(
      primaryPart && assignedToRef && primaryPart === assignedToRef
    ),
  }
}

async function main() {
  const { practiceId, encounterIds: ids } = parsePracticeAndEncounterIds()
  const ehr = await createEhrClientForPractice(practiceId, { timeoutMs: 120_000 })
  if (!ehr) {
    console.error('No ecw_write connection for practice', practiceId)
    process.exit(1)
  }

  const labelList =
    process.env.ENCOUNTER_LABELS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || []

  const rows: Normalized[] = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const label =
      process.env[`ENCOUNTER_LABEL_${i + 1}`]?.trim() ||
      labelList[i] ||
      `row_${i + 1}`
    try {
      const enc = (await ehr.client.request(`/Encounter/${encodeURIComponent(id)}`)) as Record<
        string,
        unknown
      >
      rows.push(normalizeEncounter(label, enc))
    } catch (e) {
      rows.push(
        normalizeEncounter(label, null, e instanceof Error ? e.message : String(e))
      )
    }
  }

  const diffKeys = [
    'status',
    'assignedToRef',
    'participantRefs',
    'participantMatchesAssignedTo',
    'class',
    'extensionUrls',
    'pharmacyPresent',
    'serviceProvider',
    'locationRefs',
    'period',
  ] as const

  const table = rows.map((r) => {
    const o: Record<string, unknown> = { label: r.label, id: r.id }
    if (r.error) {
      o.error = r.error
      return o
    }
    for (const k of diffKeys) {
      o[k] = r[k]
    }
    o.messagesLen = r.messagesLen
    o.notesLen = r.notesLen
    o.subject = r.subject
    return o
  })

  const payload = {
    generatedAt: new Date().toISOString(),
    practiceId,
    encounterIds: ids,
    comparisonTable: table,
    fullNormalized: rows,
  }

  const outDir = path.join(process.cwd(), 'scripts', 'output', 'telephone-encounter-lila')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `comparison-${Date.now()}.json`)
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2))

  console.log(JSON.stringify({ wrote: outFile, comparisonTable: table }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
