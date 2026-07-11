import { prisma } from '@/lib/db'
import { resolvePatientByContact } from '@/lib/patient-identity'
import { normalizePhoneToE164 } from '@/lib/curogram'
import { emitEvent } from '@/lib/outbox'
import { LIST_CSV_HEADERS } from '@/lib/lists/constants'

export { LIST_CSV_HEADERS }

export type ListCsvRowResult = {
  row: number
  name: string
  email: string | null
  phone: string | null
  status: 'matched' | 'created' | 'skipped' | 'error'
  matchedBy?: 'email' | 'phone' | 'created'
  patientId?: string
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

const HEADER_ALIASES: Record<string, 'name' | 'email' | 'phone'> = {
  'patient name': 'name',
  name: 'name',
  'full name': 'name',
  'email address': 'email',
  email: 'email',
  'phone number': 'phone',
  phone: 'phone',
  mobile: 'phone',
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
  rows: Array<{ name: string; email: string; phone: string }>
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
  const columnMap: Partial<Record<'name' | 'email' | 'phone', number>> = {}
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

  const rows: Array<{ name: string; email: string; phone: string }> = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const name = columnMap.name !== undefined ? cells[columnMap.name] || '' : ''
    const email = columnMap.email !== undefined ? cells[columnMap.email] || '' : ''
    const phone = columnMap.phone !== undefined ? cells[columnMap.phone] || '' : ''
    if (!name && !email && !phone) continue
    rows.push({ name, email, phone })
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

    if (!name) {
      skippedCount++
      rowResults.push({
        row: rowNumber,
        name: row.name,
        email,
        phone,
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
      })

      if (resolved.ambiguous) {
        skippedCount++
        rowResults.push({
          row: rowNumber,
          name,
          email,
          phone,
          status: 'skipped',
          error: 'Ambiguous patient match',
        })
        continue
      }

      let patient = resolved.patient
      let matchedBy: 'email' | 'phone' | 'created' | undefined
      let status: 'matched' | 'created' = 'matched'

      if (patient) {
        matchedBy =
          resolved.matchReason === 'email' || resolved.matchReason === 'email_dob'
            ? 'email'
            : 'phone'
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
          status: 'skipped',
          patientId: patient.id,
          matchedBy,
          error: 'Already on list',
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
        status,
        matchedBy,
        patientId: patient.id,
      })
    } catch (error) {
      errorCount++
      rowResults.push({
        row: rowNumber,
        name,
        email,
        phone,
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
