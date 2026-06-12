/**
 * One-off: compare ECW Encounter read-by-id vs patient search (run with --_env-file=.env.vercel).
 *   npx tsx --env-file=.env.vercel scripts/probe-ecw-encounter-read.ts
 */
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'

const PRACTICE_ID = '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const ENC_ID =
  process.env.PROBE_ENCOUNTER_ID ||
  'W6s8TGka96L4tHbCRoQU8RT-05RwO3K0768eSevLrJeH..Trd6iOfL1nnpqeitou'
const PATIENT_ID = 'W6s8TGka96L4tHbCRoQU8XpmLs4.WU.55lKxOG.5JoM'

async function main() {
  const ehr = await createEhrClientForPractice(PRACTICE_ID, { timeoutMs: 120_000 })
  if (!ehr) throw new Error('no ecw_write client')

  const paths = [
    `/Encounter/${encodeURIComponent(ENC_ID)}`,
    `/Encounter?patient=${encodeURIComponent(PATIENT_ID)}`,
    `/Encounter?subject=${encodeURIComponent(`Patient/${PATIENT_ID}`)}`,
  ]

  for (const path of paths) {
    try {
      const r = (await ehr.client.request(path)) as Record<string, unknown>
      const entries = (r.entry as unknown[] | undefined)?.length
      if (entries != null) {
        console.log(path.split('?')[0], 'bundle', 'entries=', entries)
      } else if (r.resourceType === 'Encounter') {
        console.log(path.split('?')[0], 'Encounter', 'status=', r.status, 'ext count=', (r.extension as unknown[])?.length)
      } else {
        console.log(path, 'shape', r.resourceType)
      }
    } catch (e) {
      console.log(path.slice(0, 72), 'ERR', (e as Error).message?.slice(0, 200))
    }
  }
}

main().catch(console.error)
