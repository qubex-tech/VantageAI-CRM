/**
 * One-off: npx tsx scripts/process-aria-session.ts <sessionId>
 * Loads DATABASE_URL / OPENAI_API_KEY from .env
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(path: string) {
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // ignore missing file
  }
}

loadEnvFile(resolve(process.cwd(), '.env'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

async function main() {
  const sessionId = process.argv[2]
  if (!sessionId) {
    console.error('Usage: npx tsx scripts/process-aria-session.ts <sessionId>')
    process.exit(1)
  }

  const { prisma } = await import('../src/lib/db')
  const { runAriaSessionPipeline } = await import('../src/lib/aria/process')

  const session = await prisma.scribeSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    console.error('Session not found')
    process.exit(1)
  }

  console.log('Processing session', sessionId, 'status=', session.status)
  const result = await runAriaSessionPipeline({
    sessionId,
    practiceId: session.practiceId,
    notify: false,
  })
  console.log('Done', result)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  process.exit(1)
})
