/**
 * Fetch Encounter resources from eCW and print a compact summary:
 * status, class, period, participant, extension URLs + assignedTo ref + message previews.
 *
 * eCW often returns **total: 0** for `Encounter?patient=` on telephone encounters; in that case set
 * `EXTRA_ENCOUNTER_IDS` (comma-separated) to read by id (e.g. ids from scenario script output).
 *
 *   npx tsx --env-file=.env.vercel scripts/inspect-ecw-encounters-for-patient.ts [practiceId] [patientId]
 *   EXTRA_ENCOUNTER_IDS='id1,id2' npx tsx --env-file=.env.vercel scripts/inspect-ecw-encounters-for-patient.ts
 *
 * Defaults patient = Lila Monroe test id if omitted.
 */
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'
import { FhirClient } from '../src/lib/integrations/fhir/fhirClient'

const PRACTICE_ID = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const PATIENT_ID =
  process.argv[3]?.trim() || 'W6s8TGka96L4tHbCRoQU8XpmLs4.WU.55lKxOG.5JoM'

type FhirBundle = {
  entry?: Array<{ resource?: Record<string, unknown> }>
  link?: Array<{ relation?: string; url?: string }>
}

function summarizeEncounter(enc: Record<string, unknown>) {
  const ext = (enc.extension as Array<{ url?: string; valueString?: string; valueReference?: { reference?: string } }>) || []
  const extSummary = ext.map((e) => {
    const u = e.url || ''
    if (e.valueReference?.reference) return { url: u, ref: e.valueReference.reference }
    if (e.valueString) return { url: u, valuePreview: e.valueString.slice(0, 120).replace(/\s+/g, ' ') }
    return { url: u }
  })
  const participant = enc.participant as Array<{ individual?: { reference?: string } }> | undefined
  return {
    id: enc.id,
    status: enc.status,
    class: enc.class,
    type: enc.type,
    period: enc.period,
    participantRefs: participant?.map((p) => p.individual?.reference).filter(Boolean),
    serviceProvider: (enc.serviceProvider as { reference?: string } | undefined)?.reference,
    locationRefs: (enc.location as Array<{ location?: { reference?: string } }> | undefined)?.map(
      (l) => l.location?.reference
    ),
    extensions: extSummary,
  }
}

async function fetchEncounterPages(client: FhirClient, initialPath: string) {
  const encounters: Record<string, unknown>[] = []
  let nextPath: string | undefined = initialPath

  while (nextPath) {
    const bundle = (await client.request(nextPath)) as FhirBundle
    for (const entry of bundle.entry || []) {
      const r = entry.resource
      if (r && r.resourceType === 'Encounter') {
        encounters.push(r)
      }
    }
    const nextUrl = bundle.link?.find((l) => l.relation === 'next')?.url
    nextPath = nextUrl || undefined
  }

  return encounters
}

async function main() {
  const ehr = await createEhrClientForPractice(PRACTICE_ID, { timeoutMs: 120_000 })
  if (!ehr) {
    console.error('No ecw_write connection for practice', PRACTICE_ID)
    process.exit(1)
  }

  const path = `/Encounter?patient=${encodeURIComponent(PATIENT_ID)}&_count=50`
  let encounters = await fetchEncounterPages(ehr.client, path)

  const extraIds =
    process.env.EXTRA_ENCOUNTER_IDS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || []
  if (encounters.length === 0 && extraIds.length > 0) {
    for (const id of extraIds) {
      try {
        const enc = (await ehr.client.request(
          `/Encounter/${encodeURIComponent(id)}`
        )) as Record<string, unknown>
        if (enc.resourceType === 'Encounter') {
          encounters.push(enc)
        }
      } catch (e) {
        console.error('GET Encounter failed', id, (e as Error).message)
      }
    }
  }

  const rows = encounters.map(summarizeEncounter)
  console.log(
    JSON.stringify(
      {
        patientId: PATIENT_ID,
        count: rows.length,
        note:
          encounters.length === 0
            ? 'No encounters via patient search; eCW telephone rows may need EXTRA_ENCOUNTER_IDS.'
            : undefined,
        encounters: rows,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
