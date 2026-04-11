/**
 * POST a Curogram AI escalation payload from your machine (no Vercel / Retell / Inngest).
 *
 * URL resolution (first match wins):
 *   1) --url
 *   2) Retell integration for --practice (curogramEscalationUrl)
 *   3) env CUROGRAM_AI_ESCALATION_URL
 *
 * Auth (optional): CUROGRAM_AI_ESCALATION_AUTH_HEADER + CUROGRAM_AI_ESCALATION_AUTH_VALUE
 *
 * Examples:
 *   npx tsx --env-file=.env.local scripts/send-curogram-escalation.ts --phone 815-555-0116 --intent "Schedule a new appointment"
 *
 *   CUROGRAM_AI_ESCALATION_URL=https://voip.curogram.com/... npx tsx scripts/send-curogram-escalation.ts --phone +15551234567
 *
 *   npx tsx --env-file=.env.local scripts/send-curogram-escalation.ts --practice 8a48db6f-5e3c-461a-bdb9-7eca3d6acb75 --phone 2245550116 --intent "Test from script"
 *
 * Dry run (print JSON only, no HTTP):
 *   npx tsx scripts/send-curogram-escalation.ts --dry-run --phone +15551234567 --intent "Ping"
 */
import fs from 'fs'
import {
  normalizePhoneToE164,
  sendCurogramEscalation,
  trimCurogramIntentTopicForApi,
} from '../src/lib/curogram'

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1 || !process.argv[i + 1]) return undefined
  return process.argv[i + 1]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

async function main() {
  const dryRun = hasFlag('--dry-run') || process.env.DRY_RUN === '1'
  const phoneRaw = argValue('--phone')
  const intentRaw = argValue('--intent')
  const urlOverride = argValue('--url')
  const practiceId = argValue('--practice')
  const patientJsonPath = argValue('--patient-json')
  const timeoutMs = argValue('--timeout')

  if (!phoneRaw?.trim()) {
    console.error(`Usage:
  npx tsx --env-file=.env.local scripts/send-curogram-escalation.ts --phone <E.164 or US10> [--intent "…"] [--url …] [--practice <uuid>] [--patient-json path.json] [--timeout 15000] [--dry-run]

--practice  Loads curogramEscalationUrl from retell_integrations (read-only).
--url        Overrides env and DB URL.
--dry-run    Log payload only; no HTTP request.`)
    process.exit(1)
  }

  const callerNumber = normalizePhoneToE164(phoneRaw)
  if (!callerNumber) {
    console.error('Could not normalize --phone to E.164')
    process.exit(1)
  }

  let endpointUrl = urlOverride?.trim() || null
  if (!endpointUrl && practiceId?.trim()) {
    const { prisma } = await import('../src/lib/db')
    const row = await prisma.retellIntegration.findUnique({
      where: { practiceId: practiceId.trim() },
      select: { curogramEscalationUrl: true, curogramEscalationEnabled: true },
    })
    await prisma.$disconnect()
    endpointUrl = row?.curogramEscalationUrl?.trim() || null
    console.log('Loaded Retell integration', {
      practiceId: practiceId.trim(),
      curogramEscalationEnabled: row?.curogramEscalationEnabled ?? null,
      hasUrl: Boolean(endpointUrl),
    })
  }

  if (!endpointUrl) {
    endpointUrl = process.env.CUROGRAM_AI_ESCALATION_URL?.trim() || null
  }

  if (!dryRun && !endpointUrl) {
    console.error(
      'No URL: pass --url, or --practice with curogramEscalationUrl set, or set CUROGRAM_AI_ESCALATION_URL'
    )
    process.exit(1)
  }

  let patientData: Record<string, unknown> | undefined
  if (patientJsonPath?.trim()) {
    const raw = fs.readFileSync(patientJsonPath.trim(), 'utf8')
    patientData = JSON.parse(raw) as Record<string, unknown>
  }

  const intentTopic = trimCurogramIntentTopicForApi(intentRaw?.trim() || undefined)

  const payload = {
    callerNumber,
    intentTopic,
    patientData,
  }

  console.log('Payload:', JSON.stringify(payload, null, 2))
  if (endpointUrl) {
    console.log('POST', endpointUrl)
  }

  if (dryRun) {
    console.log('Dry run — skipping HTTP')
    process.exit(0)
  }

  const result = await sendCurogramEscalation(payload, {
    endpointUrl,
    requestId: `script-${Date.now()}`,
    timeoutMs: timeoutMs ? Number.parseInt(timeoutMs, 10) : undefined,
  })

  console.log('Result:', { ok: result.ok, status: result.status, bodyPreview: result.body.slice(0, 500) })
  process.exit(result.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
