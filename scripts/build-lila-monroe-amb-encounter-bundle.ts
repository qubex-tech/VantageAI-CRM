/**
 * One-off generator: Lila Monroe, FACGCD telephone-encounter extensions, class AMB (ambulatory),
 * same Practitioner / Location / Organization as working Bose payloads.
 *
 *   npx tsx scripts/build-lila-monroe-amb-encounter-bundle.ts
 *
 * Writes: scripts/output/telephone-encounter-lila/encounter-bundle-lila-monroe-amb-class.json
 */
import fs from 'fs'
import path from 'path'
import { buildTelephoneEncounterBundle, type EcwTelephoneEncounterRefs } from '../src/lib/integrations/ehr/writeback'

const LILA_EHR_PATIENT_ID = 'W6s8TGka96L4tHbCRoQU8XpmLs4.WU.55lKxOG.5JoM'

/** FACGCD defaults (same as ECW_TELEPHONE_REFS_FACGCD — participant = assignedTo Bose NPI row). */
const FACGCD_WORKING_REFS: EcwTelephoneEncounterRefs = {
  participantPractitionerRef: 'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c',
  assignedToPractitionerRef: 'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c',
  locationRef: 'Location/W6s8TGka96L4tHbCRoQU8V1DmHBjAJrx9h-SsrKuRnA',
  organizationRef: 'Organization/W6s8TGka96L4tHbCRoQU8ZfnvLnRYQ9519x5HFoW2uFnSuQOQi-FoYA2O2oMawcO',
}

const startTime = new Date()
const endTime = new Date(startTime.getTime() + 15 * 60 * 1000)

const bundle = buildTelephoneEncounterBundle({
  patientId: LILA_EHR_PATIENT_ID,
  noteText:
    'Lila Monroe — ambulatory class (AMB); telephone encounter extensions; FACGCD working refs (Bose participant/assignedTo).',
  startTime,
  endTime,
  refs: FACGCD_WORKING_REFS,
  timeZone: 'America/Chicago',
  encounterClass: { code: 'AMB', display: 'ambulatory' },
  subjectDisplay: 'Lila Monroe',
})

const outDir = path.join(process.cwd(), 'scripts', 'output', 'telephone-encounter-lila')
const outFile = path.join(outDir, 'encounter-bundle-lila-monroe-amb-class.json')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      meta: {
        description: 'Mimics working telephone encounter bundle; Encounter.class = AMB (ambulatory).',
        patientId: LILA_EHR_PATIENT_ID,
        patientDisplay: 'Lila Monroe',
        generatedAt: new Date().toISOString(),
      },
      bundle,
    },
    null,
    2
  )
)
console.log('Wrote', outFile)
