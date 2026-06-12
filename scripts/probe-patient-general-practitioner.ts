/** npx tsx --env-file=.env.vercel scripts/probe-patient-general-practitioner.ts [practiceId] [patientId] */
import { createEhrClientForPractice } from '../src/lib/integrations/ehr/scheduleSync'

const practiceId = process.argv[2] || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'
const patientId = process.argv[3] || 'W6s8TGka96L4tHbCRoQU8XpmLs4.WU.55lKxOG.5JoM'

;(async () => {
  const ehr = await createEhrClientForPractice(practiceId, { timeoutMs: 120_000 })
  if (!ehr) throw new Error('no client')
  const pat = (await ehr.client.request(`/Patient/${encodeURIComponent(patientId)}`)) as Record<
    string,
    unknown
  >
  console.log(
    JSON.stringify(
      {
        id: pat.id,
        generalPractitioner: pat.generalPractitioner,
        careTeam: pat.careTeam,
      },
      null,
      2
    )
  )
})().catch(console.error)
