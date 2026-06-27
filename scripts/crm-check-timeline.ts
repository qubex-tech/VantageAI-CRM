/**
 * Check CRM-side state for an Open Dental patient: the linked patient, recent notes,
 * and timeline entries imported from Open Dental commlogs.
 *
 * Usage: npx tsx scripts/crm-check-timeline.ts [PatNum] [envFile]
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'

const patNum = process.argv[2] || '11'
const envFile = process.argv[3] || '.env.vercel.prod'

function loadDatabaseUrl(file: string): string {
  const text = readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  throw new Error(`DATABASE_URL not found in ${file}`)
}

async function main() {
  const url = loadDatabaseUrl(envFile)
  console.log(`Using DB from ${envFile} (host: ${url.replace(/\/\/[^@]*@/, '//***@').slice(0, 60)}…)`)
  const prisma = new PrismaClient({ datasources: { db: { url } } })

  try {
    const externalEhrId = `opendental:${patNum}`
    const patients = await prisma.patient.findMany({
      where: { externalEhrId, deletedAt: null },
      select: { id: true, name: true, practiceId: true },
    })
    if (patients.length === 0) {
      console.log(`No CRM patient linked to ${externalEhrId}.`)
      return
    }

    for (const p of patients) {
      console.log('='.repeat(70))
      console.log(`Patient: ${p.name} (id ${p.id}, practice ${p.practiceId})`)

      const notes = await prisma.patientNote.findMany({
        where: { patientId: p.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { type: true, content: true, createdAt: true },
      })
      console.log(`\n  Notes tab (${notes.length} most recent):`)
      for (const n of notes) {
        console.log(`   • [${n.type}] ${n.content.slice(0, 80)}  (${n.createdAt.toISOString()})`)
      }

      const timeline = await prisma.patientTimelineEntry.findMany({
        where: { patientId: p.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { type: true, title: true, description: true, metadata: true, createdAt: true },
      })
      const odEntries = timeline.filter((t) => {
        const m = (t.metadata as Record<string, unknown> | null) || {}
        return m.source === 'opendental'
      })
      console.log(`\n  Activity timeline — Open Dental commlog entries (${odEntries.length}):`)
      for (const t of odEntries) {
        const m = (t.metadata as Record<string, unknown>) || {}
        console.log(
          `   • CommlogNum ${m.commlogNum} — "${t.title}" :: ${(t.description || '').slice(0, 80)}  (${t.createdAt.toISOString()})`
        )
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
