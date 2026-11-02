import { prisma } from '@/lib/db'
import { handleAppointmentChangeForSlotFill } from '@/lib/appointment-optimization/appointmentChangeHandler'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import type { NexHealthConnection } from '@prisma/client'
import { getNexhealthPatient, listNexhealthAppointments } from './client'
import { asNexhealthEnvironment } from './connection'
import {
  buildNexhealthAppointmentExternalId,
  buildNexhealthPatientExternalId,
  buildNexhealthProviderId,
  mapNexhealthAppointmentStatus,
  nexhealthAppointmentWindow,
  nexhealthVisitType,
} from './mapping'
import { upsertPatientFromNexhealth } from './patientSync'
import type { NexhealthAppointment } from './types'

export type NexhealthAppointmentSyncSummary = {
  fetched: number
  created: number
  updated: number
  skipped: number
  errors: number
  errorSamples: string[]
}

async function resolvePatientId(params: {
  connection: NexHealthConnection
  nexhealthPatientId: number
  cache: Map<number, string>
}): Promise<string | null> {
  const cached = params.cache.get(params.nexhealthPatientId)
  if (cached) return cached
  const externalEhrId = buildNexhealthPatientExternalId(params.nexhealthPatientId)
  const existing = await prisma.patient.findFirst({
    where: {
      practiceId: params.connection.practiceId,
      externalEhrId,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (existing) {
    params.cache.set(params.nexhealthPatientId, existing.id)
    return existing.id
  }
  const remote = await getNexhealthPatient(
    asNexhealthEnvironment(params.connection.environment),
    params.nexhealthPatientId,
    params.connection.subdomain
  )
  if (!remote) return null
  const upserted = await upsertPatientFromNexhealth({
    practiceId: params.connection.practiceId,
    patient: remote,
  })
  if (!upserted.id) return null
  params.cache.set(params.nexhealthPatientId, upserted.id)
  return upserted.id
}

export async function upsertAppointmentFromNexhealth(params: {
  connection: NexHealthConnection
  appointment: NexhealthAppointment
  patientCache?: Map<number, string>
  timeZone?: string
}): Promise<'created' | 'updated' | 'skipped'> {
  const { connection, appointment } = params
  if (appointment.unavailable) return 'skipped'
  if (!appointment.id || !appointment.patient_id) return 'skipped'

  const start = new Date(appointment.start_time)
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Appointment ${appointment.id} has no valid start_time`)
  }
  const end = appointment.end_time ? new Date(appointment.end_time) : new Date(start.getTime() + 30 * 60 * 1000)
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    end.setTime(start.getTime() + 30 * 60 * 1000)
  }

  const cache = params.patientCache ?? new Map<number, string>()
  const patientId = await resolvePatientId({
    connection,
    nexhealthPatientId: appointment.patient_id,
    cache,
  })
  if (!patientId) return 'skipped'

  const timeZone = params.timeZone || appointment.timezone || (await getPracticeTimeZone(connection.practiceId))
  const externalKey = buildNexhealthAppointmentExternalId(appointment.id)
  const providerId = appointment.provider_id ? buildNexhealthProviderId(appointment.provider_id) : null
  const visitType = nexhealthVisitType(appointment)
  const notes = [
    `Synced from NexHealth Appointment/${appointment.id}`,
    appointment.operatory_id ? `operatory:${appointment.operatory_id}` : null,
    appointment.note?.trim() || null,
  ]
    .filter(Boolean)
    .join(' — ')

  const existing = await prisma.appointment.findUnique({
    where: { calBookingId: externalKey },
    select: {
      id: true,
      practiceId: true,
      providerId: true,
      status: true,
      startTime: true,
      endTime: true,
      timezone: true,
      visitType: true,
    },
  })

  const data = {
    practiceId: connection.practiceId,
    patientId,
    providerId,
    status: mapNexhealthAppointmentStatus(appointment),
    startTime: start,
    endTime: end,
    timezone: timeZone,
    visitType,
    reason: visitType === 'NexHealth Appointment' ? null : visitType,
    notes,
  }

  const saved = await prisma.appointment.upsert({
    where: { calBookingId: externalKey },
    create: {
      ...data,
      calBookingId: externalKey,
      calEventId: 'nexhealth',
    },
    update: data,
    select: {
      id: true,
      practiceId: true,
      providerId: true,
      status: true,
      startTime: true,
      endTime: true,
      timezone: true,
      visitType: true,
    },
  })

  await handleAppointmentChangeForSlotFill({ before: existing, after: saved })
  return existing ? 'updated' : 'created'
}

export async function syncNexhealthAppointments(params: {
  connection: NexHealthConnection
  updatedSince?: string | null
  now?: Date
}): Promise<NexhealthAppointmentSyncSummary> {
  const window = nexhealthAppointmentWindow(params.now)
  const summary: NexhealthAppointmentSyncSummary = {
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorSamples: [],
  }
  const appointments = await listNexhealthAppointments(asNexhealthEnvironment(params.connection.environment), {
    subdomain: params.connection.subdomain,
    location_id: params.connection.locationId,
    start: window.start,
    end: window.end,
    ...(params.updatedSince ? { updated_since: params.updatedSince } : {}),
  })
  const cache = new Map<number, string>()
  const timeZone = await getPracticeTimeZone(params.connection.practiceId)
  for (const appointment of appointments) {
    summary.fetched += 1
    try {
      const outcome = await upsertAppointmentFromNexhealth({
        connection: params.connection,
        appointment,
        patientCache: cache,
        timeZone,
      })
      summary[outcome] += 1
    } catch (error) {
      summary.errors += 1
      if (summary.errorSamples.length < 5) {
        summary.errorSamples.push(
          error instanceof Error ? error.message : `Failed to upsert appointment ${appointment.id}`
        )
      }
    }
  }
  return summary
}
