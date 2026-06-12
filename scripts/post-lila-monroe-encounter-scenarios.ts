/**
 * Post fresh telephone Encounter rows to Lila Monroe — one POST per scenario (isolated labels, no reuse of old IDs).
 *
 * Requires ecw_write backend connection for the practice (same as other EHR scripts).
 *
 *   npx tsx --env-file=.env scripts/post-lila-monroe-encounter-scenarios.ts [practiceId]
 *
 * Limit scenarios (comma-separated slugs):
 *   SCENARIOS=01-no-assigned-extension,02-assigned-same-as-participant npx tsx --env-file=.env scripts/...
 *
 * Optional:
 *   EHR_TEST_PATIENT_ID — override patient (default Lila Monroe FACGCD test patient)
 */
import fs from 'fs'
import path from 'path'
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'
import {
  buildTelephoneEncounterBundle,
  extractResourceIdFromLocation,
  isSuccessfulTransactionStatus,
  type EcwTelephoneEncounterRefs,
} from '../src/lib/integrations/ehr/writeback'
import { getEhrSettings } from '../src/lib/integrations/ehr/server'

const PRACTICE_ID = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'

const LILA_MONROE_EHR_PATIENT_ID = 'W6s8TGka96L4tHbCRoQU8XpmLs4.WU.55lKxOG.5JoM'

const DR_BOSE_REF = 'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'
const DR_WSI_REF = 'Practitioner/W6s8TGka96L4tHbCRoQU8WSi9xbr9U1rukOaVW6NHLo'

const FACGCD_REFS: Omit<EcwTelephoneEncounterRefs, 'assignedToPractitionerRef'> = {
  participantPractitionerRef: DR_BOSE_REF,
  locationRef: 'Location/W6s8TGka96L4tHbCRoQU8V1DmHBjAJrx9h-SsrKuRnA',
  organizationRef: 'Organization/W6s8TGka96L4tHbCRoQU8ZfnvLnRYQ9519x5HFoW2uFnSuQOQi-FoYA2O2oMawcO',
}

type Scenario = {
  slug: string
  description: string
  refs: EcwTelephoneEncounterRefs
  encounterClass?: { code: string; display: string }
  encounterStatus?: string
  /** After successful POST, POST a transaction PUT (mirrors syncPatientNoteToEhrEncounter). */
  postFollowUpPut?: boolean
}

const SCENARIO_DEFINITIONS: Scenario[] = [
  {
    slug: '01-no-assigned-extension',
    description:
      'Messages + notes only (no telephoneEncounter/assignedTo) — matches older production-shaped payload.',
    refs: { ...FACGCD_REFS },
  },
  {
    slug: '02-assigned-same-as-participant',
    description: 'assignedTo extension equals participant (Bose).',
    refs: { ...FACGCD_REFS, assignedToPractitionerRef: DR_BOSE_REF },
  },
  {
    slug: '03-participant-bose-assigned-wsi',
    description: 'Participant Bose; assignedTo WSI — different assignee than participant.',
    refs: { ...FACGCD_REFS, assignedToPractitionerRef: DR_WSI_REF },
  },
  {
    slug: '04-class-amb-assigned-same',
    description: 'Encounter.class AMB + assignedTo same as participant.',
    refs: { ...FACGCD_REFS, assignedToPractitionerRef: DR_BOSE_REF },
    encounterClass: { code: 'AMB', display: 'ambulatory' },
  },
  {
    slug: '05-status-planned-assigned-same',
    description: 'FHIR status planned + assignedTo same (eCW may accept or reject).',
    refs: { ...FACGCD_REFS, assignedToPractitionerRef: DR_BOSE_REF },
    encounterStatus: 'planned',
  },
  {
    slug: '06-post-then-put-assigned-same',
    description: 'POST create then transaction PUT with same extensions (manual note sync pattern).',
    refs: { ...FACGCD_REFS, assignedToPractitionerRef: DR_BOSE_REF },
    postFollowUpPut: true,
  },
]

function selectScenarios(all: Scenario[]): Scenario[] {
  const raw = process.env.SCENARIOS?.trim()
  if (!raw) return all
  const want = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const picked = all.filter((s) => want.has(s.slug))
  if (picked.length === 0) {
    throw new Error(
      `SCENARIOS matched nothing. Wanted: ${[...want].join(', ')}. Known: ${all.map((s) => s.slug).join(', ')}`
    )
  }
  return picked
}

async function main() {
  const runStamp = new Date().toISOString()
  const ehrPatientId = process.env.EHR_TEST_PATIENT_ID?.trim() || LILA_MONROE_EHR_PATIENT_ID
  const scenarios = selectScenarios(SCENARIO_DEFINITIONS)

  const ehr = await createEhrClientForPractice(PRACTICE_ID, { timeoutMs: 120_000 })
  if (!ehr) {
    console.error('No ecw_write backend connection for practice', PRACTICE_ID)
    process.exit(1)
  }

  const settings = await getEhrSettings(PRACTICE_ID)
  const tz = settings?.ehrTimeZone?.trim() || 'America/Chicago'

  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000)

  const outDir = path.join(process.cwd(), 'scripts', 'output', 'telephone-encounter-lila-scenarios')
  fs.mkdirSync(outDir, { recursive: true })

  const results: Array<{
    slug: string
    description: string
    createOk: boolean
    createStatus?: string
    encounterId?: string | null
    putOk?: boolean
    putStatus?: string
    error?: string
  }> = []

  for (const sc of scenarios) {
    const noteText = `[${runStamp}] Lila Monroe scenario: ${sc.slug} — ${sc.description}`

    const createBundle = buildTelephoneEncounterBundle({
      patientId: ehrPatientId,
      noteText,
      startTime,
      endTime,
      refs: sc.refs,
      timeZone: tz,
      encounterClass: sc.encounterClass,
      encounterStatus: sc.encounterStatus,
      subjectDisplay: 'Lila Monroe',
    })

    let createResponse: { entry?: Array<{ response?: { status?: string; location?: string } }> }
    let createOk = false
    let createStatus: string | undefined
    let encounterId: string | null = null
    let putOk: boolean | undefined
    let putStatus: string | undefined
    let error: string | undefined

    try {
      createResponse = (await ehr.client.request('/', {
        method: 'POST',
        body: JSON.stringify(createBundle),
      })) as typeof createResponse
      createStatus = createResponse?.entry?.[0]?.response?.status
      createOk = isSuccessfulTransactionStatus(createStatus)
      const loc = createResponse?.entry?.[0]?.response?.location
      encounterId = extractResourceIdFromLocation(loc, 'Encounter') || null

      if (sc.postFollowUpPut && encounterId) {
        const putBundle = buildTelephoneEncounterBundle({
          patientId: ehrPatientId,
          noteText: `${noteText} [PUT follow-up]`,
          startTime,
          endTime,
          refs: sc.refs,
          timeZone: tz,
          encounterClass: sc.encounterClass,
          encounterStatus: sc.encounterStatus,
          encounterId,
          requestMethod: 'PUT',
          subjectDisplay: 'Lila Monroe',
        })
        const putResponse = (await ehr.client.request('/', {
          method: 'POST',
          body: JSON.stringify(putBundle),
        })) as typeof createResponse
        putStatus = putResponse?.entry?.[0]?.response?.status
        putOk = isSuccessfulTransactionStatus(putStatus)
      } else if (sc.postFollowUpPut && !encounterId) {
        putOk = false
        error = 'PUT skipped: no encounter id from create'
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      createOk = false
    }

    const row = {
      slug: sc.slug,
      description: sc.description,
      createOk,
      createStatus,
      encounterId,
      putOk,
      putStatus,
      error,
    }
    results.push(row)

    const outfile = path.join(outDir, `${sc.slug}.json`)
    fs.writeFileSync(
      outfile,
      JSON.stringify(
        {
          meta: {
            runStamp,
            practiceId: PRACTICE_ID,
            patientId: ehrPatientId,
            patientDisplay: 'Lila Monroe',
            scenario: sc,
          },
          result: row,
          createBundle,
        },
        null,
        2
      )
    )

    console.log(JSON.stringify(row))
  }

  fs.writeFileSync(
    path.join(outDir, `_summary-${runStamp.replace(/[:.]/g, '-')}.json`),
    JSON.stringify({ runStamp, practiceId: PRACTICE_ID, patientId: ehrPatientId, results }, null, 2)
  )

  if (results.some((r) => !r.createOk || r.putOk === false)) {
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
