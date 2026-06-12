/**
 * Verify production (or any DB in DATABASE_URL) telephone encounter refs:
 * issuer /facgcd, ecw_write overrides, and optional stored payload sample.
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/verify-prod-telephone-encounter-refs.ts [practiceId]
 *
 * If practiceId is omitted, uses the same default as print-ehr-writeback-payload-for-call.ts (FACGCD prod).
 */
import { prisma } from '../src/lib/db'
import { getEhrSettings } from '../src/lib/integrations/ehr/server'
import {
  resolveEcwTelephoneEncounterRefs,
  telephoneDefaultBucketFromIssuer,
} from '../src/lib/integrations/ehr/writeback'

/** FACGCD defaults from ECW_TELEPHONE_REFS_FACGCD — must match encounter bundle expectations. */
const EXPECTED = {
  participantPractitionerRef: 'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c',
  locationRef: 'Location/W6s8TGka96L4tHbCRoQU8V1DmHBjAJrx9h-SsrKuRnA',
  organizationRef:
    'Organization/W6s8TGka96L4tHbCRoQU8ZfnvLnRYQ9519x5HFoW2uFnSuQOQi-FoYA2O2oMawcO',
}

const DEFAULT_PRACTICE_ID = '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'

function refsMatch(resolved: ReturnType<typeof resolveEcwTelephoneEncounterRefs>): {
  ok: boolean
  details: string[]
} {
  const details: string[] = []
  let ok = true
  if (resolved.participantPractitionerRef !== EXPECTED.participantPractitionerRef) {
    ok = false
    details.push(
      `participantPractitionerRef: got ${resolved.participantPractitionerRef}, expected ${EXPECTED.participantPractitionerRef}`
    )
  }
  if (resolved.locationRef !== EXPECTED.locationRef) {
    ok = false
    details.push(`locationRef: got ${resolved.locationRef}, expected ${EXPECTED.locationRef}`)
  }
  if (resolved.organizationRef !== EXPECTED.organizationRef) {
    ok = false
    details.push(
      `organizationRef: got ${resolved.organizationRef}, expected ${EXPECTED.organizationRef}`
    )
  }
  return { ok, details }
}

function encounterFromBundlePayload(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const entry = (payload as { entry?: { resource?: Record<string, unknown> }[] }).entry
  if (!Array.isArray(entry)) return undefined
  return entry.find((e) => e?.resource?.resourceType === 'Encounter')?.resource
}

function extractFromEncounter(enc: Record<string, unknown>) {
  const participant = Array.isArray(enc.participant)
    ? (enc.participant as { individual?: { reference?: string } }[])
        .map((x) => x?.individual?.reference)
        .find(Boolean)
    : undefined
  const location = Array.isArray(enc.location)
    ? (enc.location as { location?: { reference?: string } }[])
        .map((x) => x?.location?.reference)
        .find(Boolean)
    : undefined
  const sp = enc.serviceProvider as { reference?: string } | undefined
  return {
    participant,
    location,
    serviceProvider: sp?.reference,
  }
}

async function main() {
  const practiceId = (process.argv[2]?.trim() || DEFAULT_PRACTICE_ID) as string

  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { id: true, name: true },
  })
  if (!practice) {
    console.error(`Practice not found: ${practiceId}`)
    process.exit(1)
  }

  const connections = await prisma.ehrConnection.findMany({
    where: { tenantId: practiceId },
    select: { id: true, providerId: true, issuer: true, status: true },
    orderBy: { updatedAt: 'desc' },
  })

  console.log('=== Practice ===')
  console.log(JSON.stringify(practice, null, 2))

  console.log('\n=== ehr_connections (this practice) ===')
  if (connections.length === 0) {
    console.log('No EhrConnection rows for tenantId — cannot verify issuer bucket.')
  } else {
    for (const c of connections) {
      const issuerLower = c.issuer.toLowerCase()
      const hasFacgcd = issuerLower.includes('/facgcd')
      console.log(
        JSON.stringify(
          {
            providerId: c.providerId,
            status: c.status,
            issuerHasFacgcd: hasFacgcd,
            issuerSample: c.issuer.slice(0, 120) + (c.issuer.length > 120 ? '…' : ''),
          },
          null,
          2
        )
      )
    }
  }

  const primaryIssuer = connections[0]?.issuer ?? null
  const bucket = telephoneDefaultBucketFromIssuer(primaryIssuer)
  console.log('\n=== Issuer bucket (telephoneDefaultBucketFromIssuer) ===')
  console.log(JSON.stringify({ primaryIssuerSample: primaryIssuer?.slice(0, 100), bucket }, null, 2))

  if (primaryIssuer && !primaryIssuer.toLowerCase().includes('/facgcd')) {
    console.warn(
      '\nWARNING: Primary connection issuer does not contain /facgcd — FACGCD defaults may not apply.'
    )
  }

  const settings = await getEhrSettings(practiceId)
  const ecwWrite =
    (settings?.providerConfigs?.ecw_write as Record<string, unknown> | undefined) || {}
  console.log('\n=== providerConfigs.ecw_write (override keys only) ===')
  const keys = [
    'ecwTelephonePractitionerRef',
    'ecwTelephoneParticipantPractitionerRef',
    'ecwTelephoneAssignedToPractitionerRef',
    'ecwTelephoneLocationRef',
    'ecwTelephoneOrganizationRef',
  ]
  const trimmed: Record<string, unknown> = {}
  for (const k of keys) {
    if (ecwWrite[k] !== undefined && ecwWrite[k] !== null && String(ecwWrite[k]).trim() !== '') {
      trimmed[k] = ecwWrite[k]
    }
  }
  console.log(Object.keys(trimmed).length ? JSON.stringify(trimmed, null, 2) : '(none — code defaults apply)')

  const resolved = resolveEcwTelephoneEncounterRefs(settings, primaryIssuer)
  console.log('\n=== resolveEcwTelephoneEncounterRefs(settings, issuer) ===')
  console.log(JSON.stringify(resolved, null, 2))

  const { ok, details } = refsMatch(resolved)
  console.log('\n=== Match vs ECW_TELEPHONE_REFS_FACGCD ===')
  if (ok) {
    console.log('PASS — participant, location, and organization refs match expected FACGCD defaults.')
  } else {
    console.log('FAIL — mismatch (overrides or wrong issuer bucket):')
    for (const line of details) console.log('  -', line)
  }

  const recentRows = await prisma.voiceConversation.findMany({
    where: { practiceId },
    orderBy: { startedAt: 'desc' },
    take: 500,
    select: { id: true, retellCallId: true, startedAt: true, metadata: true },
  })
  const recent = recentRows.find((r) => {
    const m = r.metadata
    if (!m || typeof m !== 'object') return false
    return (m as Record<string, unknown>).ehrWritebackResolvedEncounterRefs != null
  })

  console.log('\n=== Latest voice_conversation with ehrWritebackResolvedEncounterRefs ===')
  if (!recent?.metadata || typeof recent.metadata !== 'object') {
    console.log('No row found with ehrWritebackResolvedEncounterRefs in metadata.')
  } else {
    const m = recent.metadata as Record<string, unknown>
    console.log(
      JSON.stringify(
        {
          voiceConversationId: recent.id,
          retellCallId: recent.retellCallId,
          startedAt: recent.startedAt,
          ehrWritebackResolvedEncounterRefs: m.ehrWritebackResolvedEncounterRefs,
          ehrWritebackTelephoneIssuerBucket: m.ehrWritebackTelephoneIssuerBucket,
        },
        null,
        2
      )
    )
    const r = m.ehrWritebackResolvedEncounterRefs as Record<string, string> | undefined
    if (r) {
      const pr = r.participantPractitionerRef === EXPECTED.participantPractitionerRef
      const lr = r.locationRef === EXPECTED.locationRef
      const or = r.organizationRef === EXPECTED.organizationRef
      console.log(
        'Stored refs match expected:',
        pr && lr && or ? 'PASS' : 'FAIL',
        !pr || !lr || !or
          ? {
              participantPractitionerRef: pr,
              locationRef: lr,
              organizationRef: or,
            }
          : ''
      )
    }
  }

  const withPayload = recentRows.find((r) => {
    const m = r.metadata
    if (!m || typeof m !== 'object') return false
    return (m as Record<string, unknown>).ehrWritebackEncounterPayload != null
  })

  console.log('\n=== Latest voice_conversation with ehrWritebackEncounterPayload ===')
  if (!withPayload?.metadata || typeof withPayload.metadata !== 'object') {
    console.log('No row found with full encounter payload stored.')
  } else {
    const m = withPayload.metadata as Record<string, unknown>
    const payload = m.ehrWritebackEncounterPayload
    const encounter = encounterFromBundlePayload(payload)
    const from = encounter ? extractFromEncounter(encounter) : undefined
    console.log(
      JSON.stringify(
        {
          voiceConversationId: withPayload.id,
          retellCallId: withPayload.retellCallId,
          encounterParticipantLocationServiceProvider: from,
        },
        null,
        2
      )
    )
    if (from?.participant === EXPECTED.participantPractitionerRef &&
      from?.location === EXPECTED.locationRef &&
      from?.serviceProvider === EXPECTED.organizationRef
    ) {
      console.log('Stored payload participant/location/serviceProvider: PASS')
    } else if (from) {
      console.log('Stored payload participant/location/serviceProvider: FAIL or partial (see above)')
    }
  }

  if (!ok) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
