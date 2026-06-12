/**
 * Build eCW telephone Encounter transaction bundles for the same patient (variants differ by practitioner refs).
 *
 * Variants 1–2: participant + assignedTo both from that practitioner's roles.
 * Variant 3: participant + location/org from Bose (NPI row); assignedTo is a different Practitioner.
 * Variant 4: hardcoded refs — Bose participant, WSI assignedTo extension, fixed Location + Organization (no role fetch).
 *
 *   npx tsx --env-file=.env scripts/generate-telephone-encounter-payloads-two-practitioners.ts [practiceId]
 *
 * POST all bundles to FACGCD:
 *   POST_TO_EHR=1 npx tsx --env-file=.env scripts/generate-telephone-encounter-payloads-two-practitioners.ts [practiceId]
 *
 * POST only selected variant(s) (comma-separated `fileSuffix`):
 *   POST_TO_EHR=1 POST_VARIANTS=practitioner-3-bose-participant-assignee-wsi npx tsx --env-file=.env scripts/...
 */
import fs from 'fs'
import path from 'path'
import {
  createEhrClientForPractice,
  fetchEhrPractitionerDetailForPractice,
  type EhrPractitionerDetail,
} from '../src/lib/integrations/ehr/scheduleSync'
import {
  buildTelephoneEncounterBundle,
  isSuccessfulTransactionStatus,
  type EcwTelephoneEncounterRefs,
} from '../src/lib/integrations/ehr/writeback'
import { getEhrSettings } from '../src/lib/integrations/ehr/server'

const PRACTICE_ID = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'

/** Lila Monroe — raw eCW Patient id (no `Patient/` prefix). */
const LILA_MONROE_EHR_PATIENT_ID = 'W6s8TGka96L4tHbCRoQU8XpmLs4.WU.55lKxOG.5JoM'

const PRACTITIONER_1_ID = 'W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'
const PRACTITIONER_2_ID = 'W6s8TGka96L4tHbCRoQU8db7A8LCNJH9H.mdMj4IvN4'

/** Variant 3: Bose participant + different `assignedTo` (eCW transaction status 101 = wrong practitioner information). */
const PRACTITIONER_3_ASSIGNED_TO_REF =
  'Practitioner/W6s8TGka96L4tHbCRoQU8WSi9xbr9U1rukOaVW6NHLo'

const PRACTITIONER_WSI_ID = 'W6s8TGka96L4tHbCRoQU8WSi9xbr9U1rukOaVW6NHLo'

/** Variant 4 — explicit FACGCD refs (participant / assignedTo / location / serviceProvider). */
const VARIANT_4_REFS: EcwTelephoneEncounterRefs = {
  participantPractitionerRef: 'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c',
  assignedToPractitionerRef: 'Practitioner/W6s8TGka96L4tHbCRoQU8WSi9xbr9U1rukOaVW6NHLo',
  locationRef: 'Location/W6s8TGka96L4tHbCRoQU8V1DmHBjAJrx9h-SsrKuRnA',
  organizationRef: 'Organization/W6s8TGka96L4tHbCRoQU8ZfnvLnRYQ9519x5HFoW2uFnSuQOQi-FoYA2O2oMawcO',
}

function bundleRefsFromPractitionerDetail(detail: EhrPractitionerDetail): EcwTelephoneEncounterRefs {
  const t = detail.telephoneEncounterRefs
  if (!t.effectiveLocationRef?.trim() || !t.effectiveOrganizationRef?.trim()) {
    throw new Error(
      `Missing effective location or organization for practitioner ${detail.reference}. ` +
        `Refs from role: location=${t.locationRefFromRole ?? 'none'}, org=${t.organizationRefFromRole ?? 'none'}. ` +
        `Notes: ${t.notes.join('; ')}`
    )
  }
  return {
    participantPractitionerRef: t.participantPractitionerRef,
    assignedToPractitionerRef: t.assignedToPractitionerRef,
    locationRef: t.effectiveLocationRef,
    organizationRef: t.effectiveOrganizationRef,
  }
}

/** Location/org + participant from `participantDetail`; `assignedTo` extension set to `assignedToRef`. */
function bundleRefsParticipantWithAssignee(
  participantDetail: EhrPractitionerDetail,
  assignedToRef: string
): EcwTelephoneEncounterRefs {
  const base = bundleRefsFromPractitionerDetail(participantDetail)
  const normalized =
    assignedToRef.startsWith('Practitioner/') ? assignedToRef : `Practitioner/${assignedToRef}`
  return {
    ...base,
    participantPractitionerRef: participantDetail.reference,
    assignedToPractitionerRef: normalized,
  }
}

type Variant =
  | { kind: 'single'; fileSuffix: string; practitionerId: string }
  | {
      kind: 'participant_plus_assignee'
      fileSuffix: string
      participantPractitionerId: string
      assignedToPractitionerRef: string
    }
  | { kind: 'hardcoded'; fileSuffix: string; refs: EcwTelephoneEncounterRefs }

const VARIANTS: Variant[] = [
  { kind: 'single', fileSuffix: 'practitioner-1-npi-row', practitionerId: PRACTITIONER_1_ID },
  { kind: 'single', fileSuffix: 'practitioner-2-duplicate-name-row', practitionerId: PRACTITIONER_2_ID },
  {
    kind: 'participant_plus_assignee',
    fileSuffix: 'practitioner-3-bose-participant-assignee-wsi',
    participantPractitionerId: PRACTITIONER_1_ID,
    assignedToPractitionerRef: PRACTITIONER_3_ASSIGNED_TO_REF,
  },
  /** WSI practitioner — participant, assignedTo, location, org from their PractitionerRole (POST usually succeeds like variant 1). */
  { kind: 'single', fileSuffix: 'practitioner-wsi-row', practitionerId: PRACTITIONER_WSI_ID },
  {
    kind: 'hardcoded',
    fileSuffix: 'practitioner-4-bose-participant-wsi-assignedto-hardcoded-loc-org',
    refs: VARIANT_4_REFS,
  },
]

function selectVariants(all: Variant[]): Variant[] {
  const raw = process.env.POST_VARIANTS?.trim()
  if (!raw) return all
  const want = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const picked = all.filter((v) => want.has(v.fileSuffix))
  if (picked.length === 0) {
    throw new Error(
      `POST_VARIANTS matched no variants. Got: ${[...want].join(', ')}. Known: ${all.map((v) => v.fileSuffix).join(', ')}`
    )
  }
  return picked
}

async function main() {
  const postToEhr = process.env.POST_TO_EHR === '1' || process.env.POST_TO_EHR === 'true'
  const variants = selectVariants(VARIANTS)

  const ehr = await createEhrClientForPractice(PRACTICE_ID, { timeoutMs: 120_000 })
  if (!ehr) {
    console.error('No ecw_write backend connection for practice', PRACTICE_ID)
    process.exit(1)
  }
  const settings = await getEhrSettings(PRACTICE_ID)
  const tz = settings?.ehrTimeZone?.trim() || 'America/Chicago'
  const issuer = ehr.connection.issuer || ''

  const ehrPatientId = process.env.EHR_TEST_PATIENT_ID?.trim() || LILA_MONROE_EHR_PATIENT_ID

  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000)
  const noteBase =
    process.env.EHR_TEST_ENCOUNTER_NOTE?.trim() ||
    'Telephone encounter test — practitioner variants (role-derived location/org; Vantage script).'

  const outDir = path.join(process.cwd(), 'scripts', 'output', 'telephone-encounter-lila')
  fs.mkdirSync(outDir, { recursive: true })

  const postResults: Array<{ variant: string; ok: boolean; status?: string; response?: unknown }> = []

  for (const v of variants) {
    let refs: EcwTelephoneEncounterRefs
    let assigneeOverrideNote: string | undefined
    let meta: Record<string, unknown>

    if (v.kind === 'hardcoded') {
      refs = v.refs
      meta = {
        generatedAt: new Date().toISOString(),
        practiceId: PRACTICE_ID,
        issuer,
        postToEhr,
        ehrPatientId,
        variant: v.fileSuffix,
        hardcodedRefs: true,
        note: 'No Practitioner/PractitionerRole fetch; extension participant, assignedTo, location, organization fixed in script.',
        bundleRefsUsed: refs,
        disclaimer:
          'POST to {fhirBase}/ creates an Encounter in eCW. For FACGCD production only when intentional. Body = bundle object only.',
      }
    } else {
      let detail: EhrPractitionerDetail

      if (v.kind === 'single') {
        const d = await fetchEhrPractitionerDetailForPractice(PRACTICE_ID, v.practitionerId, {
          timeoutMs: 120_000,
        })
        if (!d) {
          console.error('No practitioner detail for', v.practitionerId)
          process.exit(1)
        }
        detail = d
        refs = bundleRefsFromPractitionerDetail(detail)
      } else {
        const d = await fetchEhrPractitionerDetailForPractice(PRACTICE_ID, v.participantPractitionerId, {
          timeoutMs: 120_000,
        })
        if (!d) {
          console.error('No practitioner detail for participant', v.participantPractitionerId)
          process.exit(1)
        }
        detail = d
        refs = bundleRefsParticipantWithAssignee(detail, v.assignedToPractitionerRef)
        assigneeOverrideNote =
          `assignedToPractitionerRef overridden to ${v.assignedToPractitionerRef}; location/org from participant ${detail.reference}`
      }

      const trefs = detail.telephoneEncounterRefs
      meta = {
        generatedAt: new Date().toISOString(),
        practiceId: PRACTICE_ID,
        issuer,
        postToEhr,
        ehrPatientId,
        variant: v.fileSuffix,
        practitionerReferenceFromFetch: detail.reference,
        practitionerRequestPath: detail.practitionerRequestPath,
        telephoneEncounterRefsFromParticipantFetch: {
          participantPractitionerRef: trefs.participantPractitionerRef,
          assignedToPractitionerRef: trefs.assignedToPractitionerRef,
          locationRefFromRole: trefs.locationRefFromRole,
          organizationRefFromRole: trefs.organizationRefFromRole,
          effectiveLocationRef: trefs.effectiveLocationRef,
          effectiveOrganizationRef: trefs.effectiveOrganizationRef,
          notes: trefs.notes,
        },
        assigneeOverrideNote,
        bundleRefsUsed: refs,
        disclaimer:
          'POST to {fhirBase}/ creates an Encounter in eCW. For FACGCD production only when intentional. Body = bundle object only.',
      }
    }

    const bundle = buildTelephoneEncounterBundle({
      patientId: ehrPatientId,
      noteText: `${noteBase} [${v.fileSuffix}]`,
      startTime,
      endTime,
      refs,
      timeZone: tz,
    })

    const file = path.join(outDir, `encounter-bundle-${v.fileSuffix}.json`)
    fs.writeFileSync(file, JSON.stringify({ meta, bundle }, null, 2))
    console.log('Wrote', file)

    if (postToEhr) {
      const response = (await ehr.client.request('/', {
        method: 'POST',
        body: JSON.stringify(bundle),
      })) as { entry?: Array<{ response?: { status?: string; location?: string; outcome?: unknown } }> }

      const status = response?.entry?.[0]?.response?.status
      const ok = isSuccessfulTransactionStatus(status)
      postResults.push({ variant: v.fileSuffix, ok, status, response })
      const line = {
        variant: v.fileSuffix,
        transactionStatus: status,
        ok,
        location: response?.entry?.[0]?.response?.location,
        outcome: response?.entry?.[0]?.response?.outcome,
      }
      console.log(JSON.stringify(line))
      if (!ok) {
        console.error(
          '[POST] eCW returned non-success; full bundle response:',
          JSON.stringify(response, null, 2)
        )
      }
    }
  }

  if (postToEhr) {
    const allOk = postResults.every((r) => r.ok)
    if (!allOk) {
      process.exitCode = 1
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
