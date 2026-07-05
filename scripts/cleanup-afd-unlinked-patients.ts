/**
 * Soft-delete unlinked duplicate CRM patients for AFD and reassign related records.
 *
 *   npx tsx --env-file=.env.vercel.prod scripts/cleanup-afd-unlinked-patients.ts
 */
import { prisma } from '../src/lib/db'

const PRACTICE_ID = '6a10eff8-e984-40ab-984b-57880defe60a'
const KEEP_PATIENT_ID = 'c3463ef0-99dd-4e5b-91d3-086c2fc35281'
const DELETE_PATIENT_IDS = [
  'fee6d5b3-2eb6-4e4b-87b5-132b70b98e7f',
  'dc965a0b-d148-4da8-b918-37df489765d6',
]

async function main() {
  const keep = await prisma.patient.findFirst({
    where: { id: KEEP_PATIENT_ID, practiceId: PRACTICE_ID, deletedAt: null },
    select: { id: true, name: true, externalEhrId: true },
  })
  if (!keep?.externalEhrId?.startsWith('opendental:')) {
    throw new Error(`Keep patient ${KEEP_PATIENT_ID} missing or not OD-linked — aborting`)
  }

  for (const patientId of DELETE_PATIENT_IDS) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, practiceId: PRACTICE_ID, deletedAt: null },
      select: { id: true, name: true, externalEhrId: true },
    })
    if (!patient) {
      console.log(`Skip ${patientId} — not found or already deleted`)
      continue
    }
    if (patient.externalEhrId?.startsWith('opendental:')) {
      throw new Error(`Refusing to delete OD-linked patient ${patientId}`)
    }

    const vc = await prisma.voiceConversation.updateMany({
      where: { patientId, practiceId: PRACTICE_ID },
      data: { patientId: KEEP_PATIENT_ID },
    })

    const preVisit = await prisma.preVisitChart.deleteMany({
      where: { patientId, practiceId: PRACTICE_ID },
    })

    await prisma.patient.update({
      where: { id: patientId },
      data: { deletedAt: new Date() },
    })

    console.log(
      `Deleted ${patient.name} (${patientId}): reassigned ${vc.count} voice conversation(s), removed ${preVisit.count} pre-visit chart(s)`
    )
  }

  console.log(`Done. Canonical patient: ${keep.name} (${keep.id}) → ${keep.externalEhrId}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
