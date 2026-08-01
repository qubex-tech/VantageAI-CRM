/**
 * Probe Availity eligibility playbook for a patient/policy.
 *
 *   npx tsx scripts/probe-availity-rpa-eligibility.ts <practiceId> <patientId> [policyId]
 *
 * Enable mock portal RPA on the practice (Settings) or set BROWSER_AGENT_USE_MOCK=1.
 */
import { PrismaClient } from '@prisma/client'

process.env.DATABASE_URL =
  process.env.twfvatkcekctlmdlasil_POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  const practiceId = process.argv[2]
  const patientId = process.argv[3]
  const policyId = process.argv[4]

  if (!practiceId || !patientId) {
    console.error(
      'Usage: npx tsx scripts/probe-availity-rpa-eligibility.ts <practiceId> <patientId> [policyId]'
    )
    process.exit(1)
  }

  // Ensure portal RPA is on for this probe
  await prisma.availityIntegration.upsert({
    where: { practiceId },
    create: {
      practiceId,
      portalRpaEnabled: true,
      portalRpaUseMock: process.env.BROWSER_AGENT_USE_MOCK !== '0',
      useMockResponses: true,
      isActive: true,
    },
    update: {
      portalRpaEnabled: true,
      portalRpaUseMock: process.env.BROWSER_AGENT_USE_MOCK !== '0',
    },
  })

  const { runAvailityRpaEligibility } = await import('../src/lib/browser-agent')

  const result = await runAvailityRpaEligibility({
    practiceId,
    userId: practiceId,
    patientId,
    policyId,
    sync: true,
  })

  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
