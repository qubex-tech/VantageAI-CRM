import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const practices = await prisma.practice.findMany({
    where: {
      OR: [
        { name: { contains: 'John', mode: 'insensitive' } },
        { name: { contains: 'Doe', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true },
  })
  console.log('practices', JSON.stringify(practices, null, 2))

  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { name: { contains: 'Saqib', mode: 'insensitive' } },
        { firstName: { contains: 'Saqib', mode: 'insensitive' } },
        { lastName: { contains: 'Nasir', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      practiceId: true,
    },
    take: 20,
  })
  console.log('patients', JSON.stringify(patients, null, 2))

  const practiceIds = [
    ...new Set([...practices.map((p) => p.id), ...patients.map((p) => p.practiceId)]),
  ]

  const sessions = await prisma.scribeSession.findMany({
    where: practiceIds.length ? { practiceId: { in: practiceIds } } : {},
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      practiceId: true,
      patientId: true,
      status: true,
      error: true,
      transcript: true,
      soapJson: true,
      rawModelMeta: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      updatedAt: true,
      patient: { select: { name: true, firstName: true, lastName: true } },
      chunks: {
        orderBy: { seq: 'asc' },
        select: {
          seq: true,
          kind: true,
          durationMs: true,
          transcript: true,
          mimeType: true,
          uploadedAt: true,
          audioData: true,
        },
      },
    },
  })

  for (const s of sessions) {
    const t = s.transcript || ''
    console.log('---SESSION---')
    console.log(
      JSON.stringify(
        {
          id: s.id,
          status: s.status,
          error: s.error,
          patient: s.patient,
          practiceId: s.practiceId,
          chunkCount: s.chunks.length,
          chunks: s.chunks.map((c) => ({
            seq: c.seq,
            kind: c.kind,
            durationMs: c.durationMs,
            mimeType: c.mimeType,
            hasAudio: Boolean(c.audioData && c.audioData.length > 0),
            audioBytes: c.audioData?.length ?? 0,
            transcriptLen: (c.transcript || '').length,
            transcriptPreview: (c.transcript || '').slice(0, 120),
            uploadedAt: c.uploadedAt,
          })),
          transcriptLen: t.length,
          transcriptPreview: t.slice(0, 400),
          soapJson: s.soapJson,
          rawModelMeta: s.rawModelMeta,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          updatedAt: s.updatedAt,
        },
        null,
        2
      )
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
