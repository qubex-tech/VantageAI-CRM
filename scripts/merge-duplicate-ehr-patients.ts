import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type DuplicateGroupRow = {
  practiceId: string
  externalEhrId: string
  ids: string[]
}

type ForeignKeyRef = {
  tableName: string
  columnName: string
}

function hasApplyFlag() {
  return process.argv.includes('--apply')
}

function quoteIdent(value: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`)
  }
  return `"${value}"`
}

async function getDuplicateGroups() {
  const rows = await prisma.$queryRaw<DuplicateGroupRow[]>`
    SELECT
      p."practiceId" AS "practiceId",
      p."externalEhrId" AS "externalEhrId",
      ARRAY_AGG(p.id ORDER BY p."updatedAt" DESC, p."createdAt" DESC) AS "ids"
    FROM patients p
    WHERE p."externalEhrId" IS NOT NULL
      AND p."deletedAt" IS NULL
    GROUP BY p."practiceId", p."externalEhrId"
    HAVING COUNT(*) > 1
  `
  return rows
}

async function getPatientForeignKeys() {
  const refs = await prisma.$queryRaw<ForeignKeyRef[]>`
    SELECT
      cls.relname AS "tableName",
      a.attname AS "columnName"
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY cols(attnum, ordinality) ON true
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = cols.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'patients'::regclass
  `
  return refs
}

async function mergePatientPair(params: {
  canonicalId: string
  duplicateId: string
  foreignKeys: ForeignKeyRef[]
}) {
  const { canonicalId, duplicateId, foreignKeys } = params

  await prisma.$transaction(async (tx) => {
    const [canonical, duplicate] = await Promise.all([
      tx.patient.findUnique({ where: { id: canonicalId } }),
      tx.patient.findUnique({ where: { id: duplicateId } }),
    ])

    if (!canonical || !duplicate) return

    // Keep canonical and only fill blank fields from duplicate.
    await tx.patient.update({
      where: { id: canonicalId },
      data: {
        firstName: canonical.firstName || duplicate.firstName,
        lastName: canonical.lastName || duplicate.lastName,
        preferredName: canonical.preferredName || duplicate.preferredName,
        dateOfBirth: canonical.dateOfBirth || duplicate.dateOfBirth,
        primaryPhone: canonical.primaryPhone || duplicate.primaryPhone,
        secondaryPhone: canonical.secondaryPhone || duplicate.secondaryPhone,
        phone: canonical.phone !== 'unknown' ? canonical.phone : duplicate.phone,
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

    // Resolve unique collisions before moving foreign keys.
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
        DELETE FROM campaign_enrollments dup
        USING campaign_enrollments canon
        WHERE dup."patientId" = $1
          AND canon."patientId" = $2
          AND dup."campaignId" = canon."campaignId"
      `,
      duplicateId,
      canonicalId
    )
    await tx.$executeRawUnsafe(
      `
        DELETE FROM guardian_relationships dup
        USING guardian_relationships canon
        WHERE dup."guardianId" = $1
          AND canon."guardianId" = $2
          AND dup."dependentId" = canon."dependentId"
      `,
      duplicateId,
      canonicalId
    )
    await tx.$executeRawUnsafe(
      `
        DELETE FROM guardian_relationships dup
        USING guardian_relationships canon
        WHERE dup."dependentId" = $1
          AND canon."dependentId" = $2
          AND dup."guardianId" = canon."guardianId"
      `,
      duplicateId,
      canonicalId
    )

    // Unique patient-level rows: keep canonical row when both exist.
    await tx.$executeRawUnsafe(
      `
        DELETE FROM patient_accounts
        WHERE "patientId" = $1
          AND EXISTS (
            SELECT 1 FROM patient_accounts canon WHERE canon."patientId" = $2
          )
      `,
      duplicateId,
      canonicalId
    )
    await tx.$executeRawUnsafe(
      `
        DELETE FROM communication_preferences
        WHERE "patientId" = $1
          AND EXISTS (
            SELECT 1 FROM communication_preferences canon WHERE canon."patientId" = $2
          )
      `,
      duplicateId,
      canonicalId
    )

    const skipTables = new Set(['guardian_relationships'])
    for (const ref of foreignKeys) {
      if (ref.tableName === 'patients') continue
      if (skipTables.has(ref.tableName)) continue
      const table = quoteIdent(ref.tableName)
      const column = quoteIdent(ref.columnName)
      await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
        canonicalId,
        duplicateId
      )
    }

    // Handle non-FK references stored as plain patient IDs.
    await tx.$executeRawUnsafe(
      `UPDATE referral_attributions SET "referredByPatientId" = $1 WHERE "referredByPatientId" = $2`,
      canonicalId,
      duplicateId
    )

    await tx.patient.delete({ where: { id: duplicateId } })
  })
}

async function main() {
  const apply = hasApplyFlag()
  const groups = await getDuplicateGroups()
  console.log(`[merge-duplicate-ehr-patients] Found ${groups.length} duplicate EHR ID groups`)

  if (groups.length === 0) return

  let pairs = 0
  for (const group of groups) {
    pairs += Math.max(0, group.ids.length - 1)
  }
  console.log(`[merge-duplicate-ehr-patients] Duplicate patient rows to merge: ${pairs}`)

  if (!apply) {
    console.log('[merge-duplicate-ehr-patients] Dry run only. Re-run with --apply to execute.')
    for (const group of groups) {
      console.log(
        `  practice=${group.practiceId} ehrId=${group.externalEhrId} keep=${group.ids[0]} merge=${group.ids
          .slice(1)
          .join(',')}`
      )
    }
    return
  }

  const foreignKeys = await getPatientForeignKeys()
  console.log(`[merge-duplicate-ehr-patients] FK references to re-point: ${foreignKeys.length}`)

  let merged = 0
  for (const group of groups) {
    const canonicalId = group.ids[0]
    for (const duplicateId of group.ids.slice(1)) {
      await mergePatientPair({ canonicalId, duplicateId, foreignKeys })
      merged += 1
      console.log(
        `[merge-duplicate-ehr-patients] Merged duplicate ${duplicateId} -> ${canonicalId} (practice=${group.practiceId}, ehrId=${group.externalEhrId})`
      )
    }
  }

  console.log(`[merge-duplicate-ehr-patients] Completed merges: ${merged}`)
}

main()
  .catch((error) => {
    console.error('[merge-duplicate-ehr-patients] Failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
