/**
 * Pre-production verification: practitioner detail + roles-only (same logic as test API routes).
 *
 *   node --env-file=.env --import tsx scripts/verify-practitioner-preprod.ts [practiceId] [ref]
 *
 * Optional HTTP check (start `npm run dev` first):
 *   VERIFY_HTTP=1 node --env-file=.env --import tsx scripts/verify-practitioner-preprod.ts ...
 *
 * HTTP only (skip slow in-process eCW calls):
 *   VERIFY_HTTP_ONLY=1 node --env-file=.env --import tsx scripts/verify-practitioner-preprod.ts ...
 */
import {
  fetchEhrPractitionerDetailForPractice,
  fetchEhrPractitionerRolesOnlyForPractice,
} from '../src/lib/integrations/ehr/scheduleSync'

const practiceId = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const ref = process.argv[3] || 'W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'

async function httpChecks() {
  const base = process.env.VERIFY_HTTP_BASE || 'http://127.0.0.1:3000'
  const key = process.env.EHR_BACKEND_API_KEY
  if (!key) {
    console.log('[HTTP] skipped: EHR_BACKEND_API_KEY not set')
    return
  }
  const paths = [
    ['/api/integrations/ehr/test/practitioner', 'practitioner'],
    ['/api/integrations/ehr/test/practitioner-role', 'practitioner-role'],
  ] as const
  for (const [path, label] of paths) {
    const url = `${base}${path}?practiceId=${encodeURIComponent(practiceId)}&ref=${encodeURIComponent(ref)}`
    const r = await fetch(url, { headers: { 'x-api-key': key } })
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
    const refOut = j.reference as string | undefined
    const pid = (j.practitioner as { id?: string } | undefined)?.id
    const roles = j.roles as unknown[] | undefined
    const pages = j.pagesScanned as number | undefined
    console.log(
      `[HTTP] ${label}`,
      r.status,
      JSON.stringify({
        reference: refOut,
        practitionerId: pid ?? null,
        roleCount: roles?.length,
        pagesScanned: pages ?? null,
      })
    )
    if (!r.ok) process.exitCode = 1
  }
}

async function main() {
  if (process.env.VERIFY_HTTP_ONLY === '1') {
    await httpChecks()
    return
  }

  console.log('[1] fetchEhrPractitionerDetailForPractice (≈ GET /test/practitioner)')
  const detail = await fetchEhrPractitionerDetailForPractice(practiceId, ref, { timeoutMs: 120_000 })
  if (!detail) {
    console.log(JSON.stringify({ step: 1, ok: false, error: 'no detail' }))
    process.exit(1)
  }
  console.log(
    JSON.stringify(
      {
        step: 1,
        ok: true,
        reference: detail.reference,
        practitionerId: detail.practitioner.id,
        roleCount: detail.roles.length,
        roleIds: detail.roles.map((r) => r.id).filter(Boolean),
      },
      null,
      2
    )
  )

  const idFromStep1 = detail.practitioner.id
  console.log('[2] fetchEhrPractitionerRolesOnlyForPractice (≈ GET /test/practitioner-role) with ref=', idFromStep1)
  const rolesOnly = await fetchEhrPractitionerRolesOnlyForPractice(practiceId, idFromStep1, {
    timeoutMs: 120_000,
  })
  if (!rolesOnly) {
    console.log(JSON.stringify({ step: 2, ok: false, error: 'no roles result' }))
    process.exit(1)
  }
  console.log(
    JSON.stringify(
      {
        step: 2,
        ok: true,
        reference: rolesOnly.reference,
        pagesScanned: rolesOnly.pagesScanned,
        roleCount: rolesOnly.roles.length,
        roleIds: rolesOnly.roles.map((r) => r.id).filter(Boolean),
        matchesStep1RoleCount: rolesOnly.roles.length === detail.roles.length,
      },
      null,
      2
    )
  )

  if (process.env.VERIFY_HTTP === '1') {
    console.log('[3] HTTP checks')
    await httpChecks()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
