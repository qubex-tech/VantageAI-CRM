/**
 * Probe ECW schedule Encounter search (no _count — required for eCW).
 *
 *   npx tsx --env-file=.env.vercel scripts/probe-ecw-schedule-encounters.ts
 *   PROBE_DAY=2026-05-26 npx tsx --env-file=.env.vercel scripts/probe-ecw-schedule-encounters.ts
 */
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'

const PRACTICE_ID = process.env.PROBE_PRACTICE_ID || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const PRACTITIONER_REF =
  process.env.PROBE_PRACTITIONER_REF ||
  'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'

function addUtcDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

async function main() {
  const day = process.env.PROBE_DAY || new Date().toISOString().slice(0, 10)
  const nextDay = addUtcDay(day)

  const ehr = await createEhrClientForPractice(PRACTICE_ID, { timeoutMs: 120_000 })
  if (!ehr) throw new Error('no ecw_write client')

  const query = `/Encounter?practitioner=${encodeURIComponent(
    PRACTITIONER_REF
  )}&date=ge${day}&date=lt${nextDay}`

  console.log('GET', query)
  const bundle = (await ehr.client.request(query)) as {
    entry?: Array<{ resource?: { id?: string; status?: string; period?: { start?: string } } }>
  }
  const entries = bundle.entry || []
  console.log('entries=', entries.length)
  for (const entry of entries.slice(0, 10)) {
    const r = entry.resource
    console.log(' -', r?.id, r?.status, r?.period?.start)
  }
  if (entries.length > 10) console.log(` ... and ${entries.length - 10} more`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
