import { prisma } from '@/lib/db'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import type { SchedulingSettings } from '@/lib/integrations/clinical-system/types'
import {
  resolveNexhealthBookConfigForVisitType,
  resolveNexhealthBookConfigs,
  resolveNexhealthReadConfigs,
  resolveVisitTypeFromNaturalLanguage,
} from '@/lib/integrations/clinical-system/types'
import {
  createNexhealthAppointment,
  createNexhealthPatient,
  listNexhealthAvailableSlots,
  listNexhealthPatients,
  patchNexhealthAppointment,
} from './client'
import { asNexhealthEnvironment, requireNexhealthConnection } from './connection'
import {
  buildNexhealthAppointmentExternalId,
  buildNexhealthPatientExternalId,
  buildNexhealthProviderId,
  formatNexhealthDate,
  isNexhealthPlaceholderPatient,
  mapNexhealthPatient,
  nexhealthSlotWindows,
  parseNexhealthAppointmentId,
  parseNexhealthPatientId,
} from './mapping'
import type { NexhealthPatient } from './types'

export type NexhealthOpenSlot = {
  time: string
  provNum: number
  opNum?: number
  visitType?: string
}

function last10(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

function scorePatientMatch(
  candidate: NexhealthPatient,
  target: {
    firstName: string | null
    lastName: string | null
    dateOfBirth: string | null
    email: string | null
    phone: string | null
  }
): number {
  let score = 0
  const first = (candidate.first_name ?? '').trim().toLowerCase()
  const last = (candidate.last_name ?? '').trim().toLowerCase()
  const dob = (candidate.bio?.date_of_birth ?? '').slice(0, 10)
  if (target.firstName && first === target.firstName.trim().toLowerCase()) score += 2
  if (target.lastName && last === target.lastName.trim().toLowerCase()) score += 2
  if (target.dateOfBirth && dob === target.dateOfBirth) score += 4
  if (target.email && (candidate.email ?? '').trim().toLowerCase() === target.email.trim().toLowerCase()) {
    score += 3
  }
  const candidatePhone = last10(
    candidate.bio?.cell_phone_number || candidate.bio?.phone_number || candidate.phone_number
  )
  if (target.phone && candidatePhone && candidatePhone === target.phone) score += 3
  return score
}

export async function ensureNexhealthPatientLinked(params: {
  practiceId: string
  patient: {
    id: string
    externalEhrId: string | null
    firstName: string | null
    lastName: string | null
    name: string
    dateOfBirth: Date | null
    email: string | null
    primaryPhone: string | null
    phone: string
    gender: string | null
  }
  scheduling: SchedulingSettings
}): Promise<{ id: string; externalEhrId: string | null }> {
  const existingId = parseNexhealthPatientId(params.patient.externalEhrId)
  if (existingId) {
    return { id: params.patient.id, externalEhrId: params.patient.externalEhrId }
  }

  const connection = await requireNexhealthConnection(params.practiceId)
  const environment = asNexhealthEnvironment(connection.environment)
  const dob = formatNexhealthDate(params.patient.dateOfBirth)
  const phone = params.patient.primaryPhone || params.patient.phone
  const email = params.patient.email?.trim() || ''
  const firstName = params.patient.firstName?.trim() || params.patient.name.split(' ')[0] || ''
  const lastName =
    params.patient.lastName?.trim() || params.patient.name.split(' ').slice(1).join(' ') || ''

  const matches = await listNexhealthPatients(environment, {
    subdomain: connection.subdomain,
    location_id: connection.locationId,
    inactive: false,
    ...(firstName || lastName ? { name: `${firstName} ${lastName}`.trim() } : {}),
    ...(dob ? { date_of_birth: dob } : {}),
    ...(email ? { email } : {}),
    ...(phone && phone !== 'unknown' ? { phone_number: phone } : {}),
  })
  const ranked = matches
    .map((candidate) => ({
      candidate,
      score: scorePatientMatch(candidate, {
        firstName,
        lastName,
        dateOfBirth: dob,
        email: email || null,
        phone: last10(phone),
      }),
    }))
    .filter((row) => row.score >= 6 && !isNexhealthPlaceholderPatient(row.candidate))
    .sort((a, b) => b.score - a.score)

  let chosen = ranked[0]?.candidate ?? null
  if (!chosen) {
    const book = resolveNexhealthBookConfigs(params.scheduling)[0]
    if (!book) {
      throw new Error('NexHealth booking is enabled but no provider is configured.')
    }
    if (!firstName || !lastName || !email || !dob || !phone || phone === 'unknown') {
      throw new Error(
        'Patient is not linked to NexHealth. A first name, last name, email, phone, and date of birth are required to create the chart.'
      )
    }
    chosen = await createNexhealthPatient(
      environment,
      { subdomain: connection.subdomain, locationId: connection.locationId },
      {
        providerId: book.providerId,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dob,
        gender: params.patient.gender,
      }
    )
  }

  const externalEhrId = buildNexhealthPatientExternalId(chosen.id)
  const taken = await prisma.patient.findFirst({
    where: {
      practiceId: params.practiceId,
      externalEhrId,
      NOT: { id: params.patient.id },
    },
    select: { id: true },
  })
  if (taken) {
    throw new Error('That NexHealth patient is already linked to a different CRM patient.')
  }
  const mapped = mapNexhealthPatient(chosen)
  await prisma.patient.update({
    where: { id: params.patient.id },
    data: {
      externalEhrId,
      firstName: params.patient.firstName || mapped.firstName,
      lastName: params.patient.lastName || mapped.lastName,
      name: params.patient.name || mapped.name,
      dateOfBirth: params.patient.dateOfBirth || mapped.dateOfBirth,
      email: params.patient.email || mapped.email,
      primaryPhone: params.patient.primaryPhone || mapped.primaryPhone,
      phone: params.patient.phone || mapped.primaryPhone || 'unknown',
      ehrActive: mapped.ehrActive,
    },
  })
  return { id: params.patient.id, externalEhrId }
}

export async function getNexhealthOpenSlots(params: {
  practiceId: string
  scheduling: SchedulingSettings
  dateFrom: string
  dateTo: string
  appointmentType?: string | null
  eventTypeId?: string | null
}): Promise<NexhealthOpenSlot[]> {
  const connection = await requireNexhealthConnection(params.practiceId)
  const visitType =
    [params.appointmentType, params.eventTypeId]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => resolveVisitTypeFromNaturalLanguage(params.scheduling, value))
      .find((value): value is string => Boolean(value)) ?? null

  const book = visitType
    ? resolveNexhealthBookConfigForVisitType(params.scheduling, visitType)
    : null
  let configs = resolveNexhealthReadConfigs(params.scheduling)
  if (book) {
    const forProvider = configs.filter((row) => row.providerId === book.providerId)
    if (forProvider.length > 0) configs = forProvider
  }
  if (configs.length === 0) {
    throw new Error(
      'NexHealth availability is enabled but no reading providers/operatories are configured.'
    )
  }

  const windows = nexhealthSlotWindows(params.dateFrom, params.dateTo)
  const environment = asNexhealthEnvironment(connection.environment)
  const slots: NexhealthOpenSlot[] = []
  const seen = new Set<string>()

  for (const config of configs) {
    for (const window of windows) {
      const groups = await listNexhealthAvailableSlots(environment, {
        subdomain: connection.subdomain,
        startDate: window.startDate,
        days: window.days,
        locationId: connection.locationId,
        providerIds: [config.providerId],
        operatoryIds: config.operatoryIds,
        slotLength: config.lengthMinutes,
      })
      for (const group of groups) {
        const providerId = group.pid || config.providerId
        for (const slot of group.slots ?? []) {
          const operatoryId = slot.operatory_id ?? group.operatory_id ?? null
          if (
            operatoryId &&
            config.operatoryIds.length > 0 &&
            !config.operatoryIds.includes(operatoryId)
          ) {
            continue
          }
          const instant = new Date(slot.time)
          if (Number.isNaN(instant.getTime())) continue
          const time = instant.toISOString()
          const key = `${time}:${providerId}:${operatoryId ?? ''}`
          if (seen.has(key)) continue
          seen.add(key)
          slots.push({
            time,
            provNum: providerId,
            ...(operatoryId ? { opNum: operatoryId } : {}),
            ...(visitType ? { visitType } : {}),
          })
        }
      }
    }
  }

  slots.sort((a, b) => a.time.localeCompare(b.time))
  return slots
}

export async function bookNexhealthAppointment(params: {
  practiceId: string
  patientId: string
  externalEhrId: string
  startTime: string
  timezone: string
  reason?: string
  scheduling: SchedulingSettings
  appointmentType?: string | null
  eventTypeId?: string | null
  preferredOpNum?: number | null
  preferredProviderId?: number | null
}): Promise<{
  appointmentId: string
  calBookingId: string
  startTime: string
  endTime: string
  confirmationMessage: string
}> {
  const patientId = parseNexhealthPatientId(params.externalEhrId)
  if (!patientId) {
    throw new Error(
      'Patient is not linked to NexHealth. Could not match or create a NexHealth patient for booking.'
    )
  }
  const connection = await requireNexhealthConnection(params.practiceId)
  const visitType =
    [params.appointmentType, params.eventTypeId]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => resolveVisitTypeFromNaturalLanguage(params.scheduling, value) || value)
      .find(Boolean) ?? null
  const book =
    (visitType ? resolveNexhealthBookConfigForVisitType(params.scheduling, visitType) : null) ??
    resolveNexhealthBookConfigs(params.scheduling).find((row) => row.visitTypes.length === 0) ??
    resolveNexhealthBookConfigs(params.scheduling)[0]
  if (!book) {
    throw new Error('NexHealth booking is enabled but no provider/operatory is configured.')
  }
  const providerId =
    params.preferredProviderId && book.providerId === params.preferredProviderId
      ? params.preferredProviderId
      : book.providerId
  const operatoryId =
    params.preferredOpNum && book.operatoryIds.includes(params.preferredOpNum)
      ? params.preferredOpNum
      : book.operatoryIds[0]
  const start = new Date(params.startTime)
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid appointment start time')
  }
  const end = new Date(start.getTime() + book.lengthMinutes * 60 * 1000)
  const created = await createNexhealthAppointment(
    asNexhealthEnvironment(connection.environment),
    { subdomain: connection.subdomain, locationId: connection.locationId },
    {
      patientId,
      providerId,
      operatoryId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      note: params.reason,
    }
  )
  const practiceTimeZone = (await getPracticeTimeZone(params.practiceId)) || params.timezone
  const externalKey = buildNexhealthAppointmentExternalId(created.id)
  const label = visitType || 'NexHealth Appointment'
  const appointment = await prisma.appointment.upsert({
    where: { calBookingId: externalKey },
    create: {
      practiceId: params.practiceId,
      patientId: params.patientId,
      providerId: buildNexhealthProviderId(providerId),
      status: 'scheduled',
      startTime: start,
      endTime: end,
      timezone: practiceTimeZone,
      visitType: label,
      reason: params.reason,
      notes: `Booked in NexHealth Appointment/${created.id}`,
      calBookingId: externalKey,
      calEventId: 'nexhealth',
    },
    update: {
      patientId: params.patientId,
      providerId: buildNexhealthProviderId(providerId),
      status: 'scheduled',
      startTime: start,
      endTime: end,
      timezone: practiceTimeZone,
      visitType: label,
      reason: params.reason,
    },
  })

  const spoken = start.toLocaleString('en-US', { timeZone: practiceTimeZone })
  return {
    appointmentId: appointment.id,
    calBookingId: externalKey,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    confirmationMessage: `Your appointment has been scheduled for ${spoken}.`,
  }
}

async function patchLinkedAppointment(params: {
  practiceId: string
  calBookingId: string | null | undefined
  appt: { cancelled?: boolean; confirmed?: boolean }
}): Promise<void> {
  const appointmentId = parseNexhealthAppointmentId(params.calBookingId)
  if (!appointmentId) return
  const connection = await requireNexhealthConnection(params.practiceId)
  await patchNexhealthAppointment(
    asNexhealthEnvironment(connection.environment),
    connection.subdomain,
    appointmentId,
    params.appt
  )
}

export async function confirmNexhealthAppointment(params: {
  practiceId: string
  calBookingId: string | null | undefined
}): Promise<void> {
  await patchLinkedAppointment({ ...params, appt: { confirmed: true } })
}

export async function cancelNexhealthAppointment(params: {
  practiceId: string
  calBookingId: string | null | undefined
}): Promise<void> {
  await patchLinkedAppointment({ ...params, appt: { cancelled: true } })
}
