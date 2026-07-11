import { prisma } from '@/lib/db'
import { normalizeDobToIso, resolvePatientByContact } from '@/lib/patient-identity'
import { normalizePhoneToE164 } from '@/lib/curogram'
import { emitEvent } from '@/lib/outbox'
import { LIST_CSV_HEADERS } from '@/lib/lists/constants'

export { LIST_CSV_HEADERS }

export type ListCsvRowResult = {
  row: number
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  status: 'matched' | 'created' | 'skipped' | 'error'
  matchedBy?: 'email' | 'phone' | 'name' | 'created'
  patientId?: string
  tagged?: boolean
  error?: string
}

export type ImportListCsvResult = {
  importId: string
  totalRows: number
  matchedCount: number
  createdCount: number
  skippedCount: number
  errorCount: number
  rows: ListCsvRowResult[]
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

const HEADER_ALIASES: Record<string, 'name' | 'email' | 'phone' | 'dob'> = {
  'patient name': 'name',
  name: 'name',
  'full name': 'name',
  'email address': 'email',
  email: 'email',
  'phone number': 'phone',
  phone: 'phone',
  mobile: 'phone',
  'date of birth': 'dob',
  dob: 'dob',
  birthday: 'dob',
  birthdate: 'dob',
}

export function splitPatientName(fullName: string): { firstName: string; lastName: string; name: string } {
  const name = fullName.trim().replace(/\s+/g, ' ')
  if (!name) return { firstName: '', lastName: '', name: '' }
  const parts = name.split(' ')
  if (parts.length === 1) return { firstName: parts[0], lastName: '', name }
  const lastName = parts[parts.length - 1]
  const firstName = parts.slice(0, -1).join(' ')
  return { firstName, lastName, name }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

export function parseListCsv(csvText: string): {
  rows: Array<{ name: string; email: string; phone: string; dateOfBirth: string }>
  errors: string[]
} {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { rows: [], errors: ['CSV is empty'] }
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader)
  const columnMap: Partial<Record<'name' | 'email' | 'phone' | 'dob', number>> = {}
  headerCells.forEach((header, index) => {
    const mapped = HEADER_ALIASES[header]
    if (mapped && columnMap[mapped] === undefined) {
      columnMap[mapped] = index
    }
  })

  const errors: string[] = []
  if (columnMap.name === undefined) errors.push('Missing required column: Patient Name')
  if (columnMap.email === undefined && columnMap.phone === undefined) {
    errors.push('CSV must include Email Address and/or Phone Number')
  }
  if (errors.length > 0) return { rows: [], errors }

  const rows: Array<{ name: string; email: string; phone: string; dateOfBirth: string }> = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const name = columnMap.name !== undefined ? cells[columnMap.name] || '' : ''
    const email = columnMap.email !== undefined ? cells[columnMap.email] || '' : ''
    const phone = columnMap.phone !== undefined ? cells[columnMap.phone] || '' : ''
    const dateOfBirth = columnMap.dob !== undefined ? cells[columnMap.dob] || '' : ''
    if (!name && !email && !phone && !dateOfBirth) continue
    rows.push({ name, email, phone, dateOfBirth })
  }

  return { rows, errors: [] }
}

function patientPayloadForEvent(patient: {
  id: string
  name: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  primaryPhone?: string | null
  dateOfBirth: Date | null
}) {
  return {
    id: patient.id,
    name: patient.name,
    firstName: patient.firstName ?? null,
    lastName: patient.lastName ?? null,
    email: patient.email ?? null,
    phone: patient.primaryPhone || patient.phone || null,
    primaryPhone: patient.primaryPhone ?? null,
    dateOfBirth: patient.dateOfBirth?.toISOString() ?? null,
  }
}

/** Tag the patient with the list name so membership is visible on the profile. */
export async function ensurePatientListTag(patientId: string, listName: string) {
  const tag = listName.trim()
  if (!tag) return
  await prisma.patientTag.upsert({
    where: {
      patientId_tag: {
        patientId,
        tag,
      },
    },
    update: {},
    create: {
      patientId,
      tag,
    },
  })
}

function matchChannel(
  matchReason: string | undefined
): 'email' | 'phone' | 'name' {
  if (!matchReason) return 'phone'
  if (matchReason.startsWith('email')) return 'email'
  if (matchReason.startsWith('name')) return 'name'
  return 'phone'
}

export async function importListCsv(params: {
  practiceId: string
  listId: string
  csvText: string
  fileName?: string
  emitMemberAdded?: boolean
}): Promise<ImportListCsvResult> {
  const list = await prisma.patientList.findFirst({
    where: { id: params.listId, practiceId: params.practiceId },
  })
  if (!list) {
    throw new Error('List not found')
  }

  const parsed = parseListCsv(params.csvText)
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.join('; '))
  }

  const importRecord = await prisma.patientListImport.create({
    data: {
      practiceId: params.practiceId,
      listId: params.listId,
      fileName: params.fileName || null,
      status: 'processing',
      totalRows: parsed.rows.length,
    },
  })

  const rowResults: ListCsvRowResult[] = []
  let matchedCount = 0
  let createdCount = 0
  let skippedCount = 0
  let errorCount = 0
  let newlyAdded = 0

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]
    const rowNumber = i + 2 // account for header
    const { firstName, lastName, name } = splitPatientName(row.name)
    const email = row.email.trim() || null
    const phoneRaw = row.phone.trim() || null
    const phone = phoneRaw ? normalizePhoneToE164(phoneRaw) || phoneRaw : null
    const dobIso = normalizeDobToIso(row.dateOfBirth.trim() || null)
    const dateOfBirth = dobIso ? new Date(`${dobIso}T00:00:00.000Z`) : null

    if (!name) {
      skippedCount++
      rowResults.push({
        row: rowNumber,
        name: row.name,
        email,
        phone,
        dateOfBirth: dobIso,
        status: 'skipped',
        error: 'Missing patient name',
      })
      continue
    }

    if (!email && !phone) {
      skippedCount++
      rowResults.push({
        row: rowNumber,
        name,
        email,
        phone,
        dateOfBirth: dobIso,
        status: 'skipped',
        error: 'Missing email and phone',
      })
      continue
    }

    try {
      const resolved = await resolvePatientByContact({
        practiceId: params.practiceId,
        name,
        email,
        phone,
        dateOfBirth: dobIso,
      })

      if (resolved.ambiguous) {
        skippedCount++
        rowResults.push({
          row: rowNumber,
          name,
          email,
          phone,
          dateOfBirth: dobIso,
          status: 'skipped',
          error: dobIso
            ? 'Ambiguous patient match (multiple patients share contact info and DOB did not uniquely identify one)'
            : 'Ambiguous patient match (add Date of Birth to disambiguate)',
        })
        continue
      }

      let patient = resolved.patient
      let matchedBy: 'email' | 'phone' | 'name' | 'created' | undefined
      let status: 'matched' | 'created' = 'matched'

      if (patient) {
        matchedBy = matchChannel(resolved.matchReason)
        // Backfill DOB on matched patient when CSV provides one and CRM is missing it
        if (dateOfBirth && !patient.dateOfBirth) {
          patient = await prisma.patient.update({
            where: { id: patient.id },
            data: { dateOfBirth },
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              primaryPhone: true,
              dateOfBirth: true,
              secondaryPhone: true,
              externalEhrId: true,
            },
          })
        }
      } else {
        patient = await prisma.patient.create({
          data: {
            practiceId: params.practiceId,
            name,
            firstName: firstName || null,
            lastName: lastName || null,
            email,
            phone: phone || '',
            primaryPhone: phone,
            dateOfBirth,
            preferredContactMethod: 'sms',
            consentSource: 'import',
          },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            primaryPhone: true,
            dateOfBirth: true,
            secondaryPhone: true,
            externalEhrId: true,
          },
        })
        matchedBy = 'created'
        status = 'created'
      }

      // Always tag with the list name when we resolve a patient (including already-on-list)
      await ensurePatientListTag(patient.id, list.name)

      const existingMember = await prisma.patientListMember.findUnique({
        where: {
          listId_patientId: {
            listId: params.listId,
            patientId: patient.id,
          },
        },
      })

      if (existingMember) {
        skippedCount++
        rowResults.push({
          row: rowNumber,
          name,
          email,
          phone,
          dateOfBirth: dobIso,
          status: 'skipped',
          patientId: patient.id,
          matchedBy,
          tagged: true,
          error: 'Already on list (list tag ensured)',
        })
        continue
      }

      await prisma.patientListMember.create({
        data: {
          practiceId: params.practiceId,
          listId: params.listId,
          patientId: patient.id,
          source: 'csv',
          matchedBy,
        },
      })
      newlyAdded++
      if (status === 'matched') matchedCount++
      else createdCount++

      if (params.emitMemberAdded !== false) {
        await emitEvent({
          practiceId: params.practiceId,
          eventName: 'crm/list.member_added',
          entityType: 'patient_list_member',
          entityId: patient.id,
          data: {
            list: { id: list.id, name: list.name },
            patient: patientPayloadForEvent(patient),
          },
        })
      }

      rowResults.push({
        row: rowNumber,
        name,
        email,
        phone,
        dateOfBirth: dobIso,
        status,
        matchedBy,
        patientId: patient.id,
        tagged: true,
      })
    } catch (error) {
      errorCount++
      rowResults.push({
        row: rowNumber,
        name,
        email,
        phone,
        dateOfBirth: dobIso,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown import error',
      })
    }
  }

  if (newlyAdded > 0) {
    await prisma.patientList.update({
      where: { id: params.listId },
      data: { memberCount: { increment: newlyAdded } },
    })
  }

  await prisma.patientListImport.update({
    where: { id: importRecord.id },
    data: {
      status: 'completed',
      matchedCount,
      createdCount,
      skippedCount: skippedCount + errorCount,
      errorSummary: {
        errorCount,
        rows: rowResults.filter((r) => r.status === 'error' || r.status === 'skipped').slice(0, 100),
      },
    },
  })

  return {
    importId: importRecord.id,
    totalRows: parsed.rows.length,
    matchedCount,
    createdCount,
    skippedCount,
    errorCount,
    rows: rowResults,
  }
}
