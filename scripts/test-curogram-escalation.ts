/**
 * End-to-end test of Curogram escalation using the same helpers as production:
 * `buildCurogramIntentTopicWithPatientContext` + `trimCurogramIntentTopicForApi` + `sendCurogramEscalation`.
 *
 *   npx tsx --env-file=.env.local scripts/test-curogram-escalation.ts
 *   npx tsx scripts/test-curogram-escalation.ts --url https://voip.curogram.com/ai-escalation-to-text/<guid> --phone +15551234567
 *
 * URL: --url, or CUROGRAM_AI_ESCALATION_URL, or --practice <uuid> (reads retell_integrations).
 */
import {
  buildCurogramIntentTopicWithPatientContext,
  normalizePhoneToE164,
  sendCurogramEscalation,
  trimCurogramIntentTopicForApi,
} from '../src/lib/curogram'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined
}

async function main() {
  const urlArg = arg('--url')
  const practiceId = arg('--practice')
  const phoneArg = arg('--phone') || '+15551234567'

  let endpointUrl = urlArg?.trim() || process.env.CUROGRAM_AI_ESCALATION_URL?.trim() || null

  if (!endpointUrl && practiceId?.trim()) {
    const { prisma } = await import('../src/lib/db')
    const row = await prisma.retellIntegration.findUnique({
      where: { practiceId: practiceId.trim() },
      select: { curogramEscalationUrl: true },
    })
    await prisma.$disconnect()
    endpointUrl = row?.curogramEscalationUrl?.trim() || null
  }

  if (!endpointUrl) {
    console.error('Set --url, CUROGRAM_AI_ESCALATION_URL, or --practice with a configured Curogram URL.')
    process.exit(1)
  }

  const extracted = {
    call_summary:
      '[CRM integration test] Manual verification of Curogram escalation with patient context block.',
    patient_name: 'Integration Test Patient',
    patient_email: 'curogram.test@example.com',
    patient_phone_number: phoneArg,
    patient_dob: '1990-01-15',
  }

  const intentTopic = trimCurogramIntentTopicForApi(
    buildCurogramIntentTopicWithPatientContext({
      extracted,
      defaultIntent: process.env.CUROGRAM_AI_ESCALATION_DEFAULT_INTENT || 'AI call escalation',
    })
  )

  const callerNumber = normalizePhoneToE164(phoneArg)
  if (!callerNumber) {
    console.error('Invalid --phone')
    process.exit(1)
  }

  const payload = {
    callerNumber,
    intentTopic,
    patientData: { ...extracted, source: 'scripts/test-curogram-escalation.ts' },
  }

  console.log('POST', endpointUrl)
  console.log('Payload:', JSON.stringify(payload, null, 2))

  const result = await sendCurogramEscalation(payload, {
    endpointUrl,
    requestId: `test-curogram-${Date.now()}`,
    timeoutMs: 15_000,
  })

  console.log('Result:', { ok: result.ok, status: result.status, bodyPreview: result.body.slice(0, 300) })
  process.exit(result.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
