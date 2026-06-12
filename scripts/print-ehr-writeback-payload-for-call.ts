/**
 * Print the exact telephone encounter bundle we persisted before POSTing to eCW
 * (`voice_conversations.metadata.ehrWritebackEncounterPayload`), plus related writeback fields.
 *
 *   npx tsx --env-file=.env scripts/print-ehr-writeback-payload-for-call.ts <retellCallId> [practiceId]
 *
 * Example:
 *   npx tsx --env-file=.env scripts/print-ehr-writeback-payload-for-call.ts call_1d71976039f7df81ea0118c519a
 */
import fs from 'fs'
import path from 'path'
import { prisma } from '../src/lib/db'

const retellCallId = process.argv[2]?.trim()
const practiceId = process.argv[3]?.trim() || '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'

if (!retellCallId) {
  console.error('Usage: npx tsx scripts/print-ehr-writeback-payload-for-call.ts <retellCallId> [practiceId]')
  process.exit(1)
}

async function main() {
  const vc = await prisma.voiceConversation.findFirst({
    where: { practiceId, retellCallId },
    select: {
      id: true,
      retellCallId: true,
      metadata: true,
    },
  })

  if (!vc) {
    console.error(`No voice_conversations row for retellCallId=${retellCallId} practiceId=${practiceId}`)
    process.exit(1)
  }

  const m = vc.metadata && typeof vc.metadata === 'object' ? (vc.metadata as Record<string, unknown>) : {}
  const prefix = 'ehrWriteback'
  const writebackKeys = Object.keys(m).filter((k) => k.startsWith(prefix)).sort()

  const snapshot = {
    voiceConversationId: vc.id,
    retellCallId: vc.retellCallId,
    ehrWritebackKeysPresent: writebackKeys,
    ehrWritebackStatus: m.ehrWritebackStatus,
    ehrWritebackError: m.ehrWritebackError,
    ehrWritebackVersion: m.ehrWritebackVersion,
    ehrWritebackTelephoneIssuerBucket: m.ehrWritebackTelephoneIssuerBucket,
    ehrWritebackResolvedEncounterRefs: m.ehrWritebackResolvedEncounterRefs,
    ehrWritebackEncounterExtensionUrls: m.ehrWritebackEncounterExtensionUrls,
    ehrWritebackEncounterTimeZone: m.ehrWritebackEncounterTimeZone,
    ehrWritebackEncounterId: m.ehrWritebackEncounterId,
    ehrWritebackEncounterUrl: m.ehrWritebackEncounterUrl,
  }

  console.log('=== Writeback metadata (no full payload) ===')
  console.log(JSON.stringify(snapshot, null, 2))

  const payload = m.ehrWritebackEncounterPayload
  if (payload === undefined || payload === null) {
    console.log('\n=== ehrWritebackEncounterPayload ===')
    console.log('MISSING — nothing stored for this call (old deploy, merge clobber, or markConversationMetadata missed the row).')
    console.log('Fallback: Vercel logs search callId for "[EHR Writeback] Encounter payload" JSON.')
    process.exit(0)
  }

  const outDir = path.join(process.cwd(), 'scripts', 'output', 'ehr-payload-dump')
  fs.mkdirSync(outDir, { recursive: true })
  const safe = retellCallId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const outFile = path.join(outDir, `${safe}.json`)
  const full = { dumpedAt: new Date().toISOString(), snapshot, ehrWritebackEncounterPayload: payload }
  fs.writeFileSync(outFile, JSON.stringify(full, null, 2))

  console.log('\n=== ehrWritebackEncounterPayload (body POSTed to eCW as JSON.stringify) ===')
  console.log(JSON.stringify(payload, null, 2))
  console.log(`\nAlso wrote: ${outFile}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
