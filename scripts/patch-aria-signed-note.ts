/**
 * If a signed Aria session has soapJson but an empty/placeholder PatientNote,
 * rewrite the note content from the regenerated SOAP.
 */
import { PrismaClient } from '@prisma/client'
import { formatSoapAsText, parseSoapJson } from '../src/lib/aria/types'

const prisma = new PrismaClient()

async function main() {
  const sessionId = process.argv[2]
  if (!sessionId) throw new Error('Usage: npx tsx scripts/patch-aria-signed-note.ts <sessionId>')

  const session = await prisma.scribeSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      soapJson: true,
      patientNoteId: true,
    },
  })
  if (!session) throw new Error('Session not found')
  if (!session.patientNoteId) {
    console.log('No patientNoteId on session — nothing to patch')
    return
  }

  const soap = parseSoapJson(session.soapJson)
  const hasBody = Boolean(
    soap.subjective.trim() ||
      soap.objective.trim() ||
      soap.assessment.trim() ||
      soap.plan.trim() ||
      (soap.addendum || '').trim()
  )
  if (!hasBody) throw new Error('Session soapJson is still empty')

  const content = `Aria Scribe Note\n\n${formatSoapAsText(soap)}`
  const note = await prisma.patientNote.update({
    where: { id: session.patientNoteId },
    data: { content },
    select: { id: true },
  })
  console.log('Patched patient note', note.id, 'chars', content.length)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
