/**
 * Resolve who a Practitioner id is:
 * 1. Paged **PractitionerRole** (FACGCD: no server-side practitioner filter).
 * 2. If no roles, paged **Practitioner** list until that id appears (when GET /Practitioner?_id fails).
 *
 *   npx tsx --env-file=.env.vercel scripts/resolve-practitioner-via-scheduleSync.ts [practiceId] [practitionerIdOrRef]
 */
import {
  fetchEhrPractitionerRolesOnlyByPractitionerRef,
  fetchPractitionerByPagingIfPresent,
  formatPractitionerName,
} from '../src/lib/integrations/ehr/scheduleSync'

const practiceId = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const practitionerInput =
  process.argv[3] || 'W6s8TGka96L4tHbCRoQU8WcRWBuy8GIWV-VrjGM8Exs'

;(async () => {
  const roleBlock = await fetchEhrPractitionerRolesOnlyByPractitionerRef(practiceId, practitionerInput, {
    timeoutMs: 180_000,
  })
  if (!roleBlock) {
    console.log(JSON.stringify({ ok: false, error: 'no connection or invalid ref' }))
    process.exit(1)
  }

  const { canonicalRef, roles, pagesScanned } = roleBlock
  const firstPractitioner = roles.find((r) => r.practitioner?.reference || r.practitioner?.display)
    ?.practitioner

  const rolesOut = roles.map((r) => ({
    practitionerRoleId: r.id,
    practitioner: r.practitioner,
    organization: r.organization?.reference,
    locations: r.location?.map((l) => l.reference),
    codeText: r.code?.map((c) => c.text || c.coding?.map((x) => `${x.code}:${x.display}`).join(',')).join(' | '),
  }))

  let fromPractitionerList: {
    source: 'Practitioner_paged_list'
    pagesNote: string
    formattedName: string | null
    identifier?: unknown
    active?: unknown
    practitioner: Record<string, unknown>
  } | null = null

  if (roles.length === 0) {
    const p = await fetchPractitionerByPagingIfPresent(practiceId, practitionerInput, {
      timeoutMs: 180_000,
      maxPages: 500,
    })
    if (p) {
      fromPractitionerList = {
        source: 'Practitioner_paged_list',
        pagesNote: 'matched while scanning GET /Practitioner pages (id not in PractitionerRole feed)',
        formattedName: formatPractitionerName(p),
        identifier: p.identifier,
        active: p.active,
        practitioner: {
          id: p.id,
          resourceType: p.resourceType,
          name: p.name,
          telecom: p.telecom,
          gender: p.gender,
        },
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        canonicalRef,
        practitionerRolePagesScanned: pagesScanned,
        roleRowCount: roles.length,
        practitionerHintFromRole: firstPractitioner || null,
        roles: rolesOut,
        fromPractitionerList,
      },
      null,
      2
    )
  )

  if (roles.length === 0 && !fromPractitionerList) {
    console.error(
      'No PractitionerRole rows and id not found in paged Practitioner list. Check ECW masterfile / inactive users.'
    )
    process.exitCode = 2
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
