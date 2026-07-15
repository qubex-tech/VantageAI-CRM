import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type CandidatePatient = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  dateOfBirth: Date | null
  phone: string
  primaryPhone: string | null
  email: string | null
  externalEhrId: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

type DuplicateGroup = {
  key: string
  canonical: CandidatePatient
  duplicates: CandidatePatient[]
}

function hasApplyFlag(): boolean {
  return process.argv.includes('--apply')
}

function getArgValue(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined
  return process.argv[idx + 1]
}

function normalizeNamePart(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function splitName(name: string | null | undefined): { first: string; last: string } {
  const normalized = normalizeNamePart(name)
  if (!normalized) return { first: '', last: '' }
  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function normalizePhone(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 10) return digits
  return ''
}

function normalizeDob(value: Date | null | undefined): string {
  if (!value) return ''
  const year = value.getUTCFullYear()
  if (year <= 1900) return ''
  return value.toISOString().slice(0, 10)
}

function scorePatient(patient: CandidatePatient): number {
  let score = 0
  if (patient.externalEhrId) score += 1000
  if (normalizePhone(patient.primaryPhone)) score += 120
  if (normalizePhone(patient.phone)) score += 80
  if (patient.email) score += 40
  if (normalizeDob(patient.dateOfBirth)) score += 30
  if (patient.notes && patient.notes.trim().length > 20) score += 10
  return score
}

function pickCanonical(group: CandidatePatient[]): CandidatePatient {
  return [...group].sort((a, b) => {
    const scoreDiff = scorePatient(b) - scorePatient(a)
    if (scoreDiff !== 0) return scoreDiff
    const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime()
    if (updatedDiff !== 0) return updatedDiff
    return a.createdAt.getTime() - b.createdAt.getTime()
  })[0]
}

function buildDuplicateGroups(patients: CandidatePatient[]): DuplicateGroup[] {
  const byIdentity = new Map<string, CandidatePatient[]>()
  for (const patient of patients) {
    const nameFromFields =
      patient.firstName || patient.lastName
        ? {
            first: normalizeNamePart(patient.firstName),
            last: normalizeNamePart(patient.lastName),
          }
        : splitName(patient.name)
    const first = nameFromFields.first
    const last = nameFromFields.last
    const dob = normalizeDob(patient.dateOfBirth)
    const phone = normalizePhone(patient.primaryPhone || patient.phone)
    if (!first || !last || !dob || !phone) continue
    const key = `${first}|${last}|${dob}|${phone}`
    const list = byIdentity.get(key) || []
    list.push(patient)
    byIdentity.set(key, list)
  }

  const output: DuplicateGroup[] = []
  for (const [key, group] of byIdentity.entries()) {
    if (group.length < 2) continue
    const canonical = pickCanonical(group)
    output.push({
      key,
      canonical,
      duplicates: group.filter((p) => p.id !== canonical.id),
    })
  }
  return output.sort((a, b) => b.duplicates.length - a.duplicates.length)
}

async function mergeDuplicateIntoCanonical(params: {
  canonicalId: string
  duplicateId: string
  callIdHint?: string
}) {
  const { canonicalId, duplicateId, callIdHint } = params
  await prisma.$transaction(async (tx) => {
    const [canonical, duplicate] = await Promise.all([
      tx.patient.findUnique({ where: { id: canonicalId } }),
      tx.patient.findUnique({ where: { id: duplicateId } }),
    ])
    if (!canonical || !duplicate || duplicate.deletedAt) return

    // Keep canonical row and only backfill empty fields.
    await tx.patient.update({
      where: { id: canonicalId },
      data: {
        firstName: canonical.firstName || duplicate.firstName,
        lastName: canonical.lastName || duplicate.lastName,
        preferredName: canonical.preferredName || duplicate.preferredName,
        dateOfBirth: canonical.dateOfBirth || duplicate.dateOfBirth,
        primaryPhone: canonical.primaryPhone || duplicate.primaryPhone,
        secondaryPhone: canonical.secondaryPhone || duplicate.secondaryPhone,
        phone: canonical.phone !== '000-000-0000' ? canonical.phone : duplicate.phone,
        email: canonical.email || duplicate.email,
        addressLine1: canonical.addressLine1 || duplicate.addressLine1,
        addressLine2: canonical.addressLine2 || duplicate.addressLine2,
        address: canonical.address || duplicate.address,
        city: canonical.city || duplicate.city,
        state: canonical.state || duplicate.state,
        postalCode: canonical.postalCode || duplicate.postalCode,
        gender: canonical.gender || duplicate.gender,
        primaryLanguage: canonical.primaryLanguage || duplicate.primaryLanguage,
        notes:
          canonical.notes && duplicate.notes && canonical.notes !== duplicate.notes
            ? `${canonical.notes}\n\n${duplicate.notes}`
            : canonical.notes || duplicate.notes,
      },
    })

    // Resolve unique collisions first, then move rows.
    await tx.$executeRawUnsafe(
      `
        DELETE FROM patient_tags dup
        USING patient_tags canon
        WHERE dup."patientId" = $1
          AND canon."patientId" = $2
          AND dup.tag = canon.tag
      `,
      duplicateId,
      canonicalId
    )
    await tx.$executeRawUnsafe(
      `
        DELETE FROM patient_list_members dup
        USING patient_list_members canon
        WHERE dup."patientId" = $1
          AND canon."patientId" = $2
          AND dup."listId" = canon."listId"
      `,
      duplicateId,
      canonicalId
    )

    await Promise.all([
      tx.patientTag.updateMany({
        where: { patientId: duplicateId },
        data: { patientId: canonicalId },
      }),
      tx.patientListMember.updateMany({
        where: { patientId: duplicateId },
        data: { patientId: canonicalId },
      }),
      tx.voiceConversation.updateMany({
        where: { patientId: duplicateId },
        data: { patientId: canonicalId },
      }),
    ])

    const archivedAt = new Date()
    const archiveNote = `[Merged into ${canonicalId} by cleanup-lonestar-retell-duplicates at ${archivedAt.toISOString()}${
      callIdHint ? `; source call ${callIdHint}` : ''
    }]`
    await tx.patient.update({
      where: { id: duplicateId },
      data: {
        deletedAt: archivedAt,
        notes: duplicate.notes ? `${duplicate.notes}\n\n${archiveNote}` : archiveNote,
      },
    })
  })
}

async function resolvePracticeId(): Promise<string> {
  const explicitPracticeId = getArgValue('--practice-id')
  if (explicitPracticeId) return explicitPracticeId

  const explicitPracticeName = getArgValue('--practice-name') || 'lonestar'
  const practice = await prisma.practice.findFirst({
    where: { name: { contains: explicitPracticeName, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!practice) {
    throw new Error(`No practice found for --practice-name "${explicitPracticeName}"`)
  }
  console.log(
    `[cleanup-lonestar-retell-duplicates] Using practice ${practice.name} (${practice.id})`
  )
  return practice.id
}

async function main() {
  const apply = hasApplyFlag()
  const limitRaw = getArgValue('--limit')
  const parsedLimit = limitRaw ? Number(limitRaw) : null
  if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
    throw new Error('Invalid --limit value; expected a positive number')
  }
  const limit = parsedLimit ?? Number.POSITIVE_INFINITY

  const practiceId = await resolvePracticeId()
  const patients = await prisma.patient.findMany({
    where: { practiceId, deletedAt: null },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      phone: true,
      primaryPhone: true,
      email: true,
      externalEhrId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const groups = buildDuplicateGroups(patients)
  console.log(`[cleanup-lonestar-retell-duplicates] Candidate duplicate groups: ${groups.length}`)
  const duplicateRows = groups.reduce((acc, g) => acc + g.duplicates.length, 0)
  console.log(`[cleanup-lonestar-retell-duplicates] Candidate duplicate rows: ${duplicateRows}`)

  if (!apply) {
    console.log('[cleanup-lonestar-retell-duplicates] Dry run only. Re-run with --apply to execute.')
    for (const group of groups.slice(0, 50)) {
      console.log(
        `  key=${group.key} keep=${group.canonical.id} merge=${group.duplicates.map((d) => d.id).join(',')}`
      )
    }
    if (groups.length > 50) {
      console.log(`  ... truncated ${groups.length - 50} additional groups`)
    }
    return
  }

  let applied = 0
  for (const group of groups) {
    for (const duplicate of group.duplicates) {
      if (applied >= limit) break
      await mergeDuplicateIntoCanonical({
        canonicalId: group.canonical.id,
        duplicateId: duplicate.id,
      })
      applied += 1
      console.log(
        `[cleanup-lonestar-retell-duplicates] Merged ${duplicate.id} -> ${group.canonical.id} (${group.key})`
      )
    }
    if (applied >= limit) break
  }
  console.log(`[cleanup-lonestar-retell-duplicates] Completed merges: ${applied}`)
}

main()
  .catch((error) => {
    console.error('[cleanup-lonestar-retell-duplicates] Failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
