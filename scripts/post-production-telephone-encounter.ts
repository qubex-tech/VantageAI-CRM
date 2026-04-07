/**
 * Build and POST a telephone Encounter transaction bundle using the same code path as
 * `writeBackRetellCallToEhr`: `resolveEcwTelephoneEncounterRefs` + `buildTelephoneEncounterBundle`,
 * then `POST {fhirBase}/` with the bundle body (identical to production).
 *
 *   npx tsx --env-file=.env scripts/post-production-telephone-encounter.ts [practiceId]
 *
 * Required:
 *   EHR_TEST_PATIENT_ID — raw eCW Patient id (no `Patient/` prefix required; CRM externalEhrId ok)
 *
 * Optional:
 *   EHR_TEST_ENCOUNTER_NOTE — note text (default: timestamped production-shaped message)
 *   DRY_RUN=1 — log bundle + refs only, do not POST
 *
 * Example:
 *   EHR_TEST_PATIENT_ID=W6s8TGka96L4tHbCRoQU8XpmLs4.WU.55lKxOG.5JoM npx tsx --env-file=.env scripts/post-production-telephone-encounter.ts
 */
import fs from 'fs'
import path from 'path'
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'
import { getEhrSettings } from '../src/lib/integrations/ehr/server'
import {
  buildTelephoneEncounterBundle,
  extractResourceIdFromLocation,
  isSuccessfulTransactionStatus,
  normalizeStoredEhrPatientId,
  resolveEcwTelephoneEncounterRefs,
  TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
  telephoneDefaultBucketFromIssuer,
} from '../src/lib/integrations/ehr/writeback'

const PRACTICE_ID = process.argv[2]?.trim() || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

function missingEncounterRefsForProduction(refs: ReturnType<typeof resolveEcwTelephoneEncounterRefs>): string[] {
  const missing: string[] = []
  if (!refs.participantPractitionerRef?.trim()) missing.push('participantPractitionerRef')
  if (!refs.assignedToPractitionerRef?.trim()) missing.push('assignedToPractitionerRef')
  if (!refs.locationRef?.trim()) missing.push('locationRef')
  return missing
}

async function main() {
  const rawPatient = process.env.EHR_TEST_PATIENT_ID?.trim()
  if (!rawPatient) {
    console.error('Set EHR_TEST_PATIENT_ID to the eCW Patient id (raw id or Patient/...).')
    process.exit(1)
  }
  const ehrPatientId = normalizeStoredEhrPatientId(rawPatient)

  const ehr = await createEhrClientForPractice(PRACTICE_ID, { timeoutMs: 120_000 })
  if (!ehr) {
    console.error('No ecw_write backend connection for practice', PRACTICE_ID)
    process.exit(1)
  }

  const settings = await getEhrSettings(PRACTICE_ID)
  const ehrTimeZone = settings?.ehrTimeZone?.trim() || undefined
  const issuer = ehr.connection.issuer || null
  const bucket = telephoneDefaultBucketFromIssuer(issuer)
  const encounterRefs = resolveEcwTelephoneEncounterRefs(settings, issuer)

  const missing = missingEncounterRefsForProduction(encounterRefs)
  if (missing.length > 0) {
    console.error('Missing encounter refs after resolve:', missing.join(', '))
    process.exit(1)
  }

  const noteText =
    process.env.EHR_TEST_ENCOUNTER_NOTE?.trim() ||
    `[production-shaped script ${new Date().toISOString()}] Telephone encounter POST from post-production-telephone-encounter.ts`

  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000)

  const encounterBundle = buildTelephoneEncounterBundle({
    patientId: ehrPatientId,
    noteText,
    startTime,
    endTime,
    refs: encounterRefs,
    timeZone: ehrTimeZone,
    ...TELEPHONE_ENCOUNTER_BUNDLE_DIRECT_ECW_OPTIONS,
  })

  const meta = {
    generatedAt: new Date().toISOString(),
    practiceId: PRACTICE_ID,
    issuerSample: issuer?.slice(0, 96) ?? null,
    issuerTelephoneBucket: bucket,
    ehrPatientId,
    encounterRefs,
    dryRun,
    fhirBase: ehr.client.getBaseUrl?.() ?? '(see connection)',
  }

  const outDir = path.join(process.cwd(), 'scripts', 'output', 'production-telephone-encounter')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `bundle-${Date.now()}.json`)
  fs.writeFileSync(outFile, JSON.stringify({ meta, bundle: encounterBundle }, null, 2))
  console.log('Wrote', outFile)

  console.log(JSON.stringify({ ...meta, bundle: '[see file]' }, null, 2))

  if (dryRun) {
    console.log('DRY_RUN=1: not POSTing to eCW.')
    return
  }

  const encounterResponse = (await ehr.client.request('/', {
    method: 'POST',
    body: JSON.stringify(encounterBundle),
  })) as {
    entry?: Array<{ response?: { status?: string | number; location?: string }; resource?: unknown }>
  }

  const encounterStatus = encounterResponse?.entry?.[0]?.response?.status
  const encounterLocation = encounterResponse?.entry?.[0]?.response?.location
  const outcomeResource = encounterResponse?.entry?.[0]?.resource

  console.log('Transaction response status:', encounterStatus)
  console.log('Location:', encounterLocation ?? null)

  if (outcomeResource && typeof outcomeResource === 'object' && 'resourceType' in outcomeResource) {
    if ((outcomeResource as { resourceType?: string }).resourceType === 'OperationOutcome') {
      console.log('OperationOutcome:', JSON.stringify(outcomeResource, null, 2))
    }
  }

  if (!isSuccessfulTransactionStatus(encounterStatus)) {
    console.error('POST failed (non-success):', encounterStatus)
    process.exit(1)
  }

  const encounterId = extractResourceIdFromLocation(encounterLocation, 'Encounter')
  console.log('Encounter id:', encounterId ?? null)
  if (encounterId) {
    console.log('Encounter URL:', `${ehr.client.getBaseUrl()}/Encounter/${encounterId}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
