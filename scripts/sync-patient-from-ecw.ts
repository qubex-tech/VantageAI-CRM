/**
 * Pull Patient demographics from eCW into CRM (backend_services / ecw_write).
 *
 *   node --env-file=.env --import tsx scripts/sync-patient-from-ecw.ts [practiceId] [patientId] [ehrPatientId?]
 *
 * Example (Leila Monroe row from Retell writeback metadata):
 *   node --env-file=.env --import tsx scripts/sync-patient-from-ecw.ts \\
 *     8a48db6f-5e3c-461a-bdb9-7eca3d6acb75 \\
 *     38d68b40-6acd-4f22-9686-0936c3dc15c4 \\
 *     W6s8TGka96L4tHbCRoQU8R0bTEMB0X-UfRRhczWx4Yw
 */
import { syncPatientDemographicsFromEhr } from '../src/lib/integrations/ehr/patientUpdate'

const practiceId = process.argv[2]
const patientId = process.argv[3]
const ehrPatientId = process.argv[4]

if (!practiceId || !patientId) {
  console.error('Usage: sync-patient-from-ecw <practiceId> <patientId> [ehrPatientId]')
  process.exit(1)
}

syncPatientDemographicsFromEhr({
  practiceId,
  patientId,
  ehrPatientId: ehrPatientId || undefined,
  actorUserId: 'system',
})
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    if (r.status === 'skipped') process.exit(2)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
