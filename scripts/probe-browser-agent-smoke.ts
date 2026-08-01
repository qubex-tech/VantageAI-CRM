/**
 * Smoke-test the browser-agent platform (mock by default).
 *
 *   npx tsx scripts/probe-browser-agent-smoke.ts [practiceId]
 *
 * Live Browserbase:
 *   BROWSER_AGENT_USE_MOCK=0 BROWSERBASE_API_KEY=... BROWSERBASE_PROJECT_ID=... \
 *     npx tsx scripts/probe-browser-agent-smoke.ts [practiceId]
 */
import { PrismaClient } from '@prisma/client'

process.env.DATABASE_URL =
  process.env.twfvatkcekctlmdlasil_POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL

async function main() {
  const practiceId = process.argv[2]
  if (!practiceId) {
    console.error('Usage: npx tsx scripts/probe-browser-agent-smoke.ts <practiceId>')
    process.exit(1)
  }

  // Ensure prisma client is generated with new models
  const { startBrowserAgentRun, listPlaybooks } = await import('../src/lib/browser-agent')

  console.log('Playbooks:', listPlaybooks())

  const useMock = process.env.BROWSER_AGENT_USE_MOCK !== '0'
  const result = await startBrowserAgentRun({
    practiceId,
    playbookId: 'browser.smoke',
    input: { probe: true },
    useMock,
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
    const prisma = new PrismaClient()
    await prisma.$disconnect().catch(() => undefined)
  })
