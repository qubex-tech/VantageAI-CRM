/**
 * Regenerate SOAP for a ScribeSession that has a transcript but empty soapJson.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/regenerate-aria-soap.ts <sessionId>
 */
import { Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { generateAriaSoapNote } from '../src/lib/aria/generate'

const prisma = new PrismaClient()

async function main() {
  const sessionId = process.argv[2]
  if (!sessionId) {
    throw new Error('Usage: npx tsx scripts/regenerate-aria-soap.ts <sessionId>')
  }

  const session = await prisma.scribeSession.findUnique({
    where: { id: sessionId },
    include: {
      patient: { select: { name: true, firstName: true, lastName: true } },
      chunks: {
        orderBy: { seq: 'asc' },
        select: { seq: true, kind: true, transcript: true },
      },
    },
  })
  if (!session) throw new Error('Session not found')

  let transcript = (session.transcript || '').trim()
  if (!transcript) {
    transcript = session.chunks
      .filter((c) => c.transcript?.trim())
      .map((c) => `${c.kind === 'dictation' ? '[Dictation]' : '[Visit]'}\n${c.transcript!.trim()}`)
      .join('\n\n')
      .trim()
  }
  if (!transcript) throw new Error('No transcript available to regenerate from')

  const patientName =
    [session.patient?.firstName, session.patient?.lastName].filter(Boolean).join(' ').trim() ||
    session.patient?.name ||
    'Patient'

  console.log('Regenerating SOAP…', {
    sessionId,
    status: session.status,
    transcriptLen: transcript.length,
    patientName,
  })

  const { soap, meta } = await generateAriaSoapNote({
    transcript,
    patientName,
  })

  console.log('SOAP preview', {
    subjective: soap.subjective.slice(0, 120),
    objective: soap.objective.slice(0, 120),
    assessment: soap.assessment.slice(0, 120),
    plan: soap.plan.slice(0, 120),
  })

  const existingMeta =
    session.rawModelMeta && typeof session.rawModelMeta === 'object'
      ? (session.rawModelMeta as Record<string, unknown>)
      : {}

  // Keep signed status if already signed; otherwise move back to review.
  const nextStatus = session.status === 'signed' ? 'signed' : 'ready_for_review'

  await prisma.scribeSession.update({
    where: { id: sessionId },
    data: {
      transcript,
      soapJson: soap as unknown as Prisma.InputJsonValue,
      status: nextStatus,
      error: null,
      rawModelMeta: {
        ...existingMeta,
        generation: {
          ...meta,
          regeneratedAt: new Date().toISOString(),
        },
      } as Prisma.InputJsonValue,
    },
  })

  console.log('Updated session', sessionId, '→', nextStatus)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
