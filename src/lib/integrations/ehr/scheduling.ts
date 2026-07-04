import { getPracticeTimeZone } from '@/lib/practice-timezone'
import {
  fetchEcwEncountersForSchedule,
  resolveEcwSchedulePractitionerRefs,
  syncEhrAppointmentsForPractice,
} from '@/lib/integrations/ehr/scheduleSync'
import {
  resolveReadLengthMinutes,
  resolveReadPractitionerRefs,
  type SchedulingSettings,
} from '@/lib/integrations/clinical-system/types'

export const DEFAULT_ECW_SLOT_LENGTH_MINUTES = 30
const DEFAULT_BUSINESS_START_HOUR = 8
const DEFAULT_BUSINESS_END_HOUR = 17

export type EcwScheduleAppointment = {
  encounterId: string
  status: string
  start: string
  end: string
  visitType: string
  patientReference: string | null
  providerReference: string | null
  schedulePractitionerRef: string | null
}

export type EcwOpenSlot = {
  start: string
  end: string
  startUtc: string
  endUtc: string
  practitionerRef: string
  lengthMinutes: number
  source: 'ecw'
}

function encounterBlocksAvailability(status: string | undefined) {
  const normalized = (status || 'planned').toLowerCase()
  return normalized !== 'cancelled' && normalized !== 'entered-in-error'
}

function getEncounterVisitType(encounter: {
  type?: Array<{ text?: string; coding?: Array<{ display?: string }> }>
}) {
  return (
    encounter.type?.[0]?.text ||
    encounter.type?.[0]?.coding?.[0]?.display ||
    'EHR Appointment'
  )
}

function mapEncountersToAppointments(
  encounters: Awaited<ReturnType<typeof fetchEcwEncountersForSchedule>>
): EcwScheduleAppointment[] {
  return encounters
    .filter((encounter) => encounter.id && encounter.period?.start)
    .map((encounter) => {
      const start = new Date(encounter.period!.start!)
      const end =
        encounter.period?.end && !Number.isNaN(new Date(encounter.period.end).getTime())
          ? new Date(encounter.period.end)
          : new Date(start.getTime() + DEFAULT_ECW_SLOT_LENGTH_MINUTES * 60_000)
      return {
        encounterId: encounter.id!,
        status: encounter.status || 'planned',
        start: start.toISOString(),
        end: end.toISOString(),
        visitType: getEncounterVisitType(encounter),
        patientReference: encounter.subject?.reference ?? null,
        providerReference: encounter.participant?.[0]?.individual?.reference ?? null,
        schedulePractitionerRef: encounter.schedulePractitionerRef ?? null,
      }
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart
}

function appointmentBelongsToPractitioner(
  appointment: EcwScheduleAppointment,
  practitionerRef: string
) {
  if (appointment.schedulePractitionerRef === practitionerRef) return true
  if (appointment.providerReference === practitionerRef) return true
  return false
}

function generateOpenSlotsForPractitioner(params: {
  practitionerRef: string
  dateStart: string
  dateEnd: string
  lengthMinutes: number
  timeZone: string
  busy: Array<{ startMs: number; endMs: number }>
}): EcwOpenSlot[] {
  const slots: EcwOpenSlot[] = []
  const startDay = new Date(`${params.dateStart}T12:00:00.000Z`)
  const endDay = new Date(`${params.dateEnd}T12:00:00.000Z`)
  const cursor = new Date(startDay)

  while (cursor <= endDay) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: params.timeZone, weekday: 'short' }).format(cursor)
    if (weekday !== 'Sat' && weekday !== 'Sun') {
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: params.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(cursor)
      const get = (type: string) => dateParts.find((part) => part.type === type)?.value || ''
      const dateStr = `${get('year')}-${get('month')}-${get('day')}`

      for (let hour = DEFAULT_BUSINESS_START_HOUR; hour < DEFAULT_BUSINESS_END_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += params.lengthMinutes) {
          if (hour === DEFAULT_BUSINESS_END_HOUR - 1 && minute + params.lengthMinutes > 60) continue
          const localStart = new Date(
            `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
          )
          const startMs = localStart.getTime()
          const endMs = startMs + params.lengthMinutes * 60_000
          if (startMs < Date.now()) continue
          if (params.busy.some((interval) => overlaps(startMs, endMs, interval.startMs, interval.endMs))) {
            continue
          }
          slots.push({
            start: localStart.toISOString(),
            end: new Date(endMs).toISOString(),
            startUtc: new Date(startMs).toISOString(),
            endUtc: new Date(endMs).toISOString(),
            practitionerRef: params.practitionerRef,
            lengthMinutes: params.lengthMinutes,
            source: 'ecw',
          })
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return slots
}

/** Best-effort open slots: business hours minus booked eCW encounters (FHIR Encounter search). */
export async function getEcwOpenSlots(params: {
  practiceId: string
  practitionerRefs: string[]
  dateStart: string
  dateEnd: string
  lengthMinutes?: number
  timeZone?: string
  syncFirst?: boolean
}): Promise<{ appointments: EcwScheduleAppointment[]; slots: EcwOpenSlot[]; practitionerRefs: string[] }> {
  const lengthMinutes = params.lengthMinutes ?? DEFAULT_ECW_SLOT_LENGTH_MINUTES
  const timeZone = params.timeZone ?? (await getPracticeTimeZone(params.practiceId))
  const practitionerRefs =
    params.practitionerRefs.length > 0
      ? params.practitionerRefs
      : await resolveEcwSchedulePractitionerRefs(params.practiceId)

  if (practitionerRefs.length === 0) {
    throw new Error('No eClinicalWorks practitioners available for schedule lookup')
  }

  if (params.syncFirst !== false) {
    try {
      await syncEhrAppointmentsForPractice(params.practiceId, {
        force: true,
        startDate: params.dateStart,
        endDate: params.dateEnd,
      })
    } catch (error) {
      console.warn('[ECW scheduling] appointment sync before slot read failed', {
        practiceId: params.practiceId,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  const encounters = await fetchEcwEncountersForSchedule({
    practiceId: params.practiceId,
    practitionerRefs,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
  })

  const appointments = mapEncountersToAppointments(encounters)
  const slots: EcwOpenSlot[] = []

  for (const practitionerRef of practitionerRefs) {
    const busy = appointments
      .filter(
        (appointment) =>
          encounterBlocksAvailability(appointment.status) &&
          appointmentBelongsToPractitioner(appointment, practitionerRef)
      )
      .map((appointment) => ({
        startMs: new Date(appointment.start).getTime(),
        endMs: new Date(appointment.end).getTime(),
      }))
      .filter((interval) => Number.isFinite(interval.startMs) && Number.isFinite(interval.endMs))

    slots.push(
      ...generateOpenSlotsForPractitioner({
        practitionerRef,
        dateStart: params.dateStart,
        dateEnd: params.dateEnd,
        lengthMinutes,
        timeZone,
        busy,
      })
    )
  }

  slots.sort((a, b) => a.startUtc.localeCompare(b.startUtc))

  return { appointments, slots, practitionerRefs }
}

export async function getEcwScheduleFromSettings(params: {
  practiceId: string
  scheduling: SchedulingSettings
  dateStart: string
  dateEnd: string
  practitionerRef?: string | null
  practitionerRefs?: string[]
  lengthMinutes?: number
  timeZone?: string
}) {
  const explicitRefs = [
    ...(params.practitionerRefs ?? []),
    ...(params.practitionerRef ? [params.practitionerRef] : []),
    ...resolveReadPractitionerRefs(params.scheduling),
  ]
  const practitionerRefs =
    explicitRefs.length > 0
      ? Array.from(new Set(explicitRefs))
      : await resolveEcwSchedulePractitionerRefs(params.practiceId, {
          scheduling: params.scheduling,
        })

  const lengthMinutes =
    params.lengthMinutes ??
    resolveReadLengthMinutes(params.scheduling) ??
    DEFAULT_ECW_SLOT_LENGTH_MINUTES

  return getEcwOpenSlots({
    practiceId: params.practiceId,
    practitionerRefs,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    lengthMinutes,
    timeZone: params.timeZone,
  })
}
