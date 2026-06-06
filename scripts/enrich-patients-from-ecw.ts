/**
 * Batch-enrich linked patients from eCW (demographics + insurance).
 *
 * Usage:
 *   npx tsx --env-file=.env --env-file=.env.vercel scripts/enrich-patients-from-ecw.ts [practiceId]
 */
import { prisma } from '../src/lib/db'
import { enrichPatientFromEhr } from '../src/lib/integrations/ehr/enrichPatientFromEhr'

const DEFAULT_PRACTICE_ID = '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'

async function main() {
  const practiceId = process.argv[2]?.trim() || DEFAULT_PRACTICE_ID
  const force = process.argv.includes('--force')

  const patients = await prisma.patient.findMany({
    where: {
      practiceId,
      deletedAt: null,
      externalEhrId: { not: null },
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  console.log(`Practice ${practiceId}: ${patients.length} linked patients`)

  let success = 0
  let skipped = 0
  let partial = 0
  let failed = 0

  for (const patient of patients) {
    const label = [patient.lastName, patient.firstName].filter(Boolean).join(', ') || patient.id
    try {
      const result = await enrichPatientFromEhr({
        practiceId,
        patientId: patient.id,
        source: 'manual',
        force,
      })
      if (result.status === 'success') {
        success++
        console.log(`OK  ${label}`)
      } else if (result.status === 'skipped') {
        skipped++
        console.log(`SKIP ${label}: ${result.reason}`)
      } else if (result.status === 'partial') {
        partial++
        console.log(`PARTIAL ${label}: ${result.message || 'partial enrich'}`)
      }
    } catch (err) {
      failed++
      console.log(`ERR ${label}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`\nDone: ${success} enriched, ${partial} partial, ${skipped} skipped, ${failed} failed`)
}

main().finally(() => prisma.$disconnect())
