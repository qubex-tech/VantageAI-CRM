import { prisma } from '@/lib/db'
import { getOpenDentalServices, getOpenDentalConnection } from './factory'
import { logOpenDentalAudit } from './audit'
import { resolveCreatedId } from './apiResponse'
import { buildExternalId, OPEN_DENTAL_EXTERNAL_PREFIX } from './patientSync'

export type PatientWritebackResult = {
  status: 'skipped' | 'success' | 'error'
  reason?: string
  patNum?: number
  externalEhrId?: string
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: parts[0] }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function mapGender(gender: string | null): string | undefined {
  if (!gender) return undefined
  const s = gender.toLowerCase()
  if (s === 'male') return 'Male'
  if (s === 'female') return 'Female'
  return 'Unknown'
}

function formatBirthdate(value: Date | null): string | undefined {
  if (!value) return undefined
  const iso = value.toISOString().slice(0, 10)
  // Skip the CRM/OD "unset" placeholder dates.
  if (iso.startsWith('1900-01-01') || iso.startsWith('0001-01-01')) return undefined
  return iso
}

/**
 * Create a patient in Open Dental for a CRM patient and link them via
 * `externalEhrId = opendental:{PatNum}` so they become bookable in OD scheduling.
 *
 * Best-effort and idempotent: no-ops when OD isn't configured or the patient is
 * already linked, and never throws (returns a status instead).
 */
export async function createOpenDentalPatientFromCrm(params: {
  practiceId: string
  patientId: string
  actorUserId?: string
}): Promise<PatientWritebackResult> {
  const { practiceId, patientId, actorUserId } = params

  const connection = await getOpenDentalConnection(practiceId)
  if (!connection || !connection.isActive) {
    return { status: 'skipped', reason: 'opendental_not_configured' }
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
  })
  if (!patient) return { status: 'skipped', reason: 'patient_not_found' }

  // Already linked to Open Dental — nothing to do.
  if (patient.externalEhrId?.startsWith(OPEN_DENTAL_EXTERNAL_PREFIX)) {
    return { status: 'skipped', reason: 'already_linked', externalEhrId: patient.externalEhrId }
  }
  // Linked to a different external system — don't clobber it.
  if (patient.externalEhrId) {
    return { status: 'skipped', reason: 'linked_to_other_system' }
  }

  // Resolve first/last name (Open Dental requires both).
  let firstName = patient.firstName?.trim() || ''
  let lastName = patient.lastName?.trim() || ''
  if (!firstName || !lastName) {
    const split = splitName(patient.name || '')
    firstName = firstName || split.first
    lastName = lastName || split.last
  }
  if (!firstName && !lastName) {
    return { status: 'skipped', reason: 'missing_name' }
  }
  if (!lastName) lastName = firstName
  if (!firstName) firstName = lastName

  const body: Record<string, unknown> = {
    LName: lastName,
    FName: firstName,
    PatStatus: 'Patient',
  }
  const preferred = patient.preferredName?.trim()
  if (preferred) body.Preferred = preferred
  const birthdate = formatBirthdate(patient.dateOfBirth)
  if (birthdate) body.Birthdate = birthdate
  const gender = mapGender(patient.gender)
  if (gender) body.Gender = gender
  const wireless = (patient.primaryPhone || patient.phone)?.trim()
  if (wireless) body.WirelessPhone = wireless
  const secondary = patient.secondaryPhone?.trim()
  if (secondary) body.HmPhone = secondary
  const email = patient.email?.trim()
  if (email) body.Email = email
  const addr1 = patient.addressLine1?.trim()
  if (addr1) body.Address = addr1
  const addr2 = patient.addressLine2?.trim()
  if (addr2) body.Address2 = addr2
  const city = patient.city?.trim()
  if (city) body.City = city
  const state = patient.state?.trim()
  if (state) body.State = state
  const zip = patient.postalCode?.trim()
  if (zip) body.Zip = zip

  try {
    const services = await getOpenDentalServices(practiceId)
    const created = await services.patients.create(body)
    const patNum = resolveCreatedId(created, 'PatNum')
    if (!patNum || patNum <= 0) {
      return { status: 'error', reason: 'missing_pat_num_in_response' }
    }
    const externalEhrId = buildExternalId(patNum)

    // Guard against an existing row already owning this link (sandbox id reuse / races).
    const conflict = await prisma.patient.findFirst({
      where: { practiceId, externalEhrId, NOT: { id: patient.id } },
      select: { id: true },
    })
    if (!conflict) {
      await prisma.patient.update({
        where: { id: patient.id },
        data: { externalEhrId },
      })
    }

    await logOpenDentalAudit({
      tenantId: practiceId,
      actorUserId,
      action: 'patient.writeback_created',
      entity: 'Patient',
      entityId: String(patNum),
      metadata: { patientId, externalEhrId, linked: !conflict },
    })

    return { status: 'success', patNum, externalEhrId }
  } catch (error) {
    return {
      status: 'error',
      reason: error instanceof Error ? error.message : 'patient writeback failed',
    }
  }
}
