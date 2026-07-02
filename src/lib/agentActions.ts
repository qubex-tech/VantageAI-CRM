/**
 * Voice Agent Actions
 * 
 * These functions handle tool calls from RetellAI voice agents
 * They perform actions like finding/creating patients, getting slots, and booking appointments
 */

import { prisma } from './db'
import { getCalClient } from './cal'
import { createAuditLog, createTimelineEntry } from './audit'
import { redactPHI } from './phi'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import {
  resolveReadLengthMinutes,
  resolveReadOperatoryNum,
  resolveReadProvNum,
} from '@/lib/integrations/clinical-system/types'
import type { SchedulingSettings } from '@/lib/integrations/clinical-system/types'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import {
  getOpenDentalOpenSlots,
  bookOpenDentalAppointment,
} from '@/lib/integrations/opendental/scheduling'
import { formatOpenDentalLocalDateTime } from '@/lib/integrations/opendental/commlogWriteback'
import { buildAppointmentExternalId } from '@/lib/integrations/opendental/appointmentSync'
import { writeBackAppointmentToOpenDental } from '@/lib/integrations/opendental/appointmentWriteback'
import {
  buildPatientIdentityFacts,
  buildSafePatientUpdate,
  demographicsMatch,
  enrichPhoneCollisionsWithOdCharts,
  fetchOpenDentalChartFacts,
  openDentalChartMatchesCaller,
  phoneMatchKey,
  resolveDemographics,
  type PatientIdentityFacts,
} from '@/lib/patient-identity'

/** Coerce a date or datetime string to a bare "yyyy-MM-dd" for Open Dental slot queries. */
function toDateOnly(value: string): string {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return value
}

const patientSchedulingSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  phone: true,
  primaryPhone: true,
  externalEhrId: true,
  email: true,
} as const

type PatientSchedulingRow = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  dateOfBirth: Date | null
  phone: string
  primaryPhone: string | null
  externalEhrId: string | null
  email: string | null
}

/**
 * When the practice books in Open Dental, ensure the CRM patient has an
 * `opendental:{PatNum}` link — creating or matching in OD when missing.
 */
async function ensureOpenDentalPatientLinkedForScheduling(
  practiceId: string,
  patient: PatientSchedulingRow
): Promise<PatientSchedulingRow> {
  const scheduling = await getSchedulingSettings(practiceId)
  if (scheduling.mode !== 'open_dental') return patient
  if (patient.externalEhrId?.startsWith('opendental:')) return patient

  const { createOpenDentalPatientFromCrm } = await import(
    '@/lib/integrations/opendental/patientWriteback'
  )
  const odResult = await createOpenDentalPatientFromCrm({
    practiceId,
    patientId: patient.id,
  })

  const refreshed = await prisma.patient.findUnique({
    where: { id: patient.id },
    select: patientSchedulingSelect,
  })
  if (refreshed?.externalEhrId?.startsWith('opendental:')) {
    return refreshed
  }

  if (odResult.status === 'success' && odResult.externalEhrId) {
    return refreshed ?? { ...patient, externalEhrId: odResult.externalEhrId }
  }

  const reason = odResult.reason ?? 'unknown error'
  if (reason === 'linked_to_other_system') {
    throw new Error(
      'Patient is linked to another system and cannot be booked in Open Dental.'
    )
  }
  throw new Error(
    `Could not link patient to Open Dental for scheduling (${reason}).`
  )
}

export interface FindOrCreatePatientResult {
  /** Null when requires_agent_decision — existing phone match found but caller identity differs. */
  patientId: string | null
  isNew: boolean
  /** True when caller must confirm same person vs new family member before proceeding. */
  requires_agent_decision: boolean
  patient: {
    id: string
    name: string
    phone: string
  } | null
  /** Ground-truth identity facts for the Retell agent (also returned by MCP resolve_patient_for_scheduling). */
  facts: PatientIdentityFacts
}

export interface AvailableSlot {
  time: string
  attendeeCount: number
}

export interface BookAppointmentResult {
  appointmentId: string
  calBookingId: string
  startTime: string
  endTime: string
  confirmationMessage: string
}

/**
 * Find or create a patient by phone number
 */
export async function findOrCreatePatientByPhone(
  practiceId: string,
  phone: string,
  details?: {
    name?: string
    dateOfBirth?: string
    email?: string
    /** When true, always create a new CRM patient even if the phone matches someone else (same phone is allowed). */
    forceCreate?: boolean
  }
): Promise<FindOrCreatePatientResult> {
  const normalizedPhone = String(phone).replace(/\D/g, '')
  const incomingKey = phoneMatchKey(phone)
  const caller = resolveDemographics(details ?? {})

  const allPatients = await prisma.patient.findMany({
    where: { practiceId, deletedAt: null },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      phone: true,
      primaryPhone: true,
      externalEhrId: true,
      email: true,
    },
  })

  const phoneCollisions = incomingKey
    ? allPatients.filter(
        (p) =>
          phoneMatchKey(p.phone) === incomingKey || phoneMatchKey(p.primaryPhone) === incomingKey
      )
    : []

  let patient: (typeof allPatients)[number] | null = null
  let isNew = false
  const callerHasFullIdentity = Boolean(
    caller.firstName && caller.lastName && caller.dateOfBirth
  )

  if (!details?.forceCreate) {
    // Prefer an exact demographics match (name + full DOB) anywhere in the practice.
    if (caller.firstName && caller.lastName && caller.dateOfBirth) {
      patient =
        allPatients.find((p) =>
          demographicsMatch(p, {
            firstName: caller.firstName!,
            lastName: caller.lastName!,
            dateOfBirth: caller.dateOfBirth!,
          })
        ) ?? null
    }

    // Phone alone is not sufficient — only reuse when demographics also match.
    if (!patient && phoneCollisions.length === 1) {
      const only = phoneCollisions[0]
      if (demographicsMatch(only, details ?? {})) {
        patient = only
      }
    }
  }

  // Single phone match and caller did not provide conflicting identity — reuse existing chart.
  if (!patient && !details?.forceCreate && phoneCollisions.length === 1 && !callerHasFullIdentity) {
    patient = phoneCollisions[0]
  }

  // Phone match but caller-provided name+DOB conflicts with every collision → return facts; let agent decide.
  if (!patient && !details?.forceCreate && phoneCollisions.length > 0 && callerHasFullIdentity) {
    const enriched = await enrichPhoneCollisionsWithOdCharts(practiceId, phoneCollisions)
    const primaryOd = enriched[0]?.open_dental_chart ?? null
    const facts = buildPatientIdentityFacts({
      caller: details ?? {},
      selectedPatient: null,
      phoneCollisions,
      enrichedPhoneCollisions: enriched,
      openDentalChart: primaryOd,
      isNew: false,
      requiresAgentDecision: true,
    })
    return {
      patientId: null,
      isNew: false,
      requires_agent_decision: true,
      patient: null,
      facts,
    }
  }

  if (!patient) {
    if (!details?.name && !caller.fullName) {
      throw new Error('Patient name is required for new patients')
    }

    const dobIso = caller.dateOfBirth
    patient = await prisma.patient.create({
      data: {
        practiceId,
        name: details?.name || caller.fullName!,
        firstName: caller.firstName ?? undefined,
        lastName: caller.lastName ?? undefined,
        phone: normalizedPhone,
        primaryPhone: normalizedPhone,
        dateOfBirth: dobIso
          ? new Date(`${dobIso}T00:00:00.000Z`)
          : new Date('1900-01-01'),
        email: details?.email || undefined,
        preferredContactMethod: 'phone',
      },
    })

    isNew = true

    const { logCustomActivity } = await import('@/lib/patient-activity')
    await logCustomActivity({
      patientId: patient.id,
      type: 'note',
      title: 'Patient created via voice call',
      description: 'Patient was created during a phone conversation',
    })
  } else if (details) {
    const odChart = await fetchOpenDentalChartFacts(practiceId, patient.externalEhrId)
    const updateData = buildSafePatientUpdate(patient, details, odChart)
    if (Object.keys(updateData).length > 0) {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: updateData,
      })
    }
  }

  try {
    patient = await ensureOpenDentalPatientLinkedForScheduling(practiceId, patient)
  } catch (error) {
    console.error('[OpenDental] Could not link patient for scheduling during find_or_create_patient', error)
  }

  const odChart = await fetchOpenDentalChartFacts(practiceId, patient.externalEhrId)
  const enriched = await enrichPhoneCollisionsWithOdCharts(practiceId, phoneCollisions)
  const facts = buildPatientIdentityFacts({
    caller: details ?? {},
    selectedPatient: patient,
    phoneCollisions,
    enrichedPhoneCollisions: enriched,
    openDentalChart: odChart,
    isNew,
  })

  return {
    patientId: patient.id,
    isNew,
    requires_agent_decision: facts.requires_agent_decision,
    patient: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
    },
    facts,
  }
}

/**
 * Read-only patient resolution for MCP — returns ground-truth identity facts without creating.
 */
export async function lookupPatientForScheduling(
  practiceId: string,
  input: {
    phone?: string
    name?: string
    firstName?: string
    lastName?: string
    dateOfBirth?: string
  }
): Promise<{ patientId: string | null; facts: PatientIdentityFacts }> {
  const incomingKey = input.phone ? phoneMatchKey(input.phone) : ''
  const caller = resolveDemographics(input)

  const allPatients = await prisma.patient.findMany({
    where: { practiceId, deletedAt: null },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      phone: true,
      primaryPhone: true,
      externalEhrId: true,
    },
  })

  const phoneCollisions = incomingKey
    ? allPatients.filter(
        (p) =>
          phoneMatchKey(p.phone) === incomingKey || phoneMatchKey(p.primaryPhone) === incomingKey
      )
    : []

  let selected: (typeof allPatients)[number] | null = null

  if (caller.firstName && caller.lastName && caller.dateOfBirth) {
    selected =
      allPatients.find((p) =>
        demographicsMatch(p, {
          firstName: caller.firstName!,
          lastName: caller.lastName!,
          dateOfBirth: caller.dateOfBirth!,
        })
      ) ?? null
  }

  if (!selected && phoneCollisions.length === 1 && demographicsMatch(phoneCollisions[0], input)) {
    selected = phoneCollisions[0]
  }

  const callerHasFullIdentity = Boolean(
    caller.firstName && caller.lastName && caller.dateOfBirth
  )

  const enriched = await enrichPhoneCollisionsWithOdCharts(practiceId, phoneCollisions)
  const odChart = selected
    ? await fetchOpenDentalChartFacts(practiceId, selected.externalEhrId)
    : enriched[0]?.open_dental_chart ?? null

  const facts = buildPatientIdentityFacts({
    caller: input,
    selectedPatient: selected,
    phoneCollisions,
    enrichedPhoneCollisions: enriched,
    openDentalChart: odChart,
    isNew: false,
    requiresAgentDecision: !selected && phoneCollisions.length > 0 && callerHasFullIdentity,
  })

  return { patientId: selected?.id ?? null, facts }
}

/**
 * Get available appointment slots
 */
export async function getAvailableSlots(
  practiceId: string,
  eventTypeId: string,
  dateFrom: string,
  dateTo: string,
  timezone: string = 'America/New_York'
): Promise<AvailableSlot[]> {
  // When the practice schedules in Open Dental, return OD open slots instead of Cal.com.
  const scheduling = await getSchedulingSettings(practiceId)
  if (scheduling.mode === 'open_dental') {
    try {
      const slots = await getOpenDentalOpenSlots({
        practiceId,
        provNum: resolveReadProvNum(scheduling),
        opNum: resolveReadOperatoryNum(scheduling),
        dateStart: toDateOnly(dateFrom),
        dateEnd: toDateOnly(dateTo),
        lengthMinutes: resolveReadLengthMinutes(scheduling),
      })
      return slots
        .filter((s) => s.startUtc)
        .map((s) => ({ time: s.startUtc as string, attendeeCount: 0 }))
    } catch (error) {
      console.error('Error fetching Open Dental slots:', error)
      throw new Error('Failed to fetch available appointment slots')
    }
  }

  const calClient = await getCalClient(practiceId)
  
  try {
    const slots = await calClient.getAvailableSlots(eventTypeId, dateFrom, dateTo, timezone)
    return slots.map(slot => ({
      time: slot.time,
      attendeeCount: slot.attendeeCount || 0,
    }))
  } catch (error) {
    console.error('Error fetching available slots:', error)
    throw new Error('Failed to fetch available appointment slots')
  }
}

/**
 * Book an appointment via Cal.com
 */
/**
 * Book directly into Open Dental for practices in EHR scheduling mode.
 * Creates the appointment in OD (source of truth) and mirrors it into the CRM.
 */
async function bookAppointmentViaOpenDental(params: {
  practiceId: string
  patientId: string
  startTime: string
  reason?: string
  scheduling: SchedulingSettings
}): Promise<BookAppointmentResult> {
  const { practiceId, patientId, startTime, reason, scheduling } = params

  const opNum = scheduling.defaultOperatoryNum ?? null
  if (!opNum) {
    throw new Error(
      'Open Dental scheduling is enabled but no default operatory is configured. Set a default operatory in Scheduling settings.'
    )
  }

  const startInstant = new Date(startTime)
  if (Number.isNaN(startInstant.getTime())) {
    throw new Error('Invalid appointment start time')
  }

  const timeZone = await getPracticeTimeZone(practiceId)
  const dateTimeStart = formatOpenDentalLocalDateTime(startInstant, timeZone)

  const result = await bookOpenDentalAppointment({
    practiceId,
    patientId,
    provNum: scheduling.defaultProvNum ?? null,
    opNum,
    dateTimeStart,
    lengthMinutes: scheduling.defaultLengthMinutes ?? null,
    note: reason ?? null,
  })

  return {
    appointmentId: result.appointmentId,
    calBookingId: buildAppointmentExternalId(result.aptNum),
    startTime: result.startTime.toISOString(),
    endTime: result.endTime.toISOString(),
    confirmationMessage: `Your appointment has been scheduled for ${result.startTime.toLocaleString('en-US', { timeZone })}.`,
  }
}

export async function bookAppointment(
  practiceId: string,
  patientId: string,
  eventTypeId: string,
  startTime: string, // ISO string
  timezone: string = 'America/New_York',
  reason?: string
): Promise<BookAppointmentResult> {
  // Get patient
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    throw new Error('Patient not found')
  }

  // Route booking to Open Dental when the practice schedules in its EHR.
  const scheduling = await getSchedulingSettings(practiceId)
  if (scheduling.mode === 'open_dental') {
    const linkedPatient = await ensureOpenDentalPatientLinkedForScheduling(practiceId, patient)
    const odChart = await fetchOpenDentalChartFacts(practiceId, linkedPatient.externalEhrId)
    if (odChart && !openDentalChartMatchesCaller(odChart, linkedPatient)) {
      throw new Error(
        `Cannot book: CRM patient "${linkedPatient.name}" (DOB ${linkedPatient.dateOfBirth?.toISOString().slice(0, 10) ?? 'unknown'}) ` +
          `is linked to Open Dental PatNum ${odChart.pat_num} (${odChart.first_name} ${odChart.last_name}, DOB ${odChart.birthdate ?? 'unknown'}). ` +
          `Resolve identity with resolve_patient_for_scheduling (MCP) or find_or_create_patient with forceCreate before booking.`
      )
    }
    if (!linkedPatient.externalEhrId?.startsWith('opendental:')) {
      throw new Error(
        'Patient is not linked to Open Dental. Could not create or match an Open Dental chart for booking.'
      )
    }
    return bookAppointmentViaOpenDental({
      practiceId,
      patientId: linkedPatient.id,
      startTime,
      reason,
      scheduling,
    })
  }

  // Get event type mapping to determine visit type
  const eventMapping = await prisma.calEventTypeMapping.findFirst({
    where: {
      practiceId,
      calEventTypeId: eventTypeId,
    },
  })

  if (!eventMapping) {
    throw new Error('Event type not mapped for this practice')
  }

  // Calculate end time (assume 30 min default, adjust based on event type if needed)
  const start = new Date(startTime)
  const end = new Date(start.getTime() + 30 * 60 * 1000) // 30 minutes

  // Validate patient has required email for Cal.com booking
  if (!patient.email || patient.email.trim() === '') {
    throw new Error('Patient email is required to book an appointment via Cal.com')
  }

  // Create Cal.com booking
  const calClient = await getCalClient(practiceId)
  const calBooking = await calClient.createBooking({
    eventTypeId,
    start: startTime,
    end: end.toISOString(),
    timeZone: timezone,
    responses: {
      name: patient.name,
      email: patient.email.trim(),
      phone: (patient.primaryPhone || patient.phone)?.trim() || undefined,
      notes: reason,
    },
  })

  // Create local appointment record
  const appointment = await prisma.appointment.create({
    data: {
      practiceId,
      patientId,
      startTime: start,
      endTime: end,
      timezone,
      visitType: eventMapping.visitTypeName,
      status: 'scheduled',
      reason: reason || undefined,
      calEventId: eventTypeId,
      calBookingId: calBooking.uid || String(calBooking.id),
    },
  })

  // Create timeline entry using new activity logging system
  const { logAppointmentActivity } = await import('@/lib/patient-activity')
  await logAppointmentActivity({
    patientId,
    appointmentId: appointment.id,
    action: 'created',
    title: `Appointment scheduled: ${eventMapping.visitTypeName}`,
    description: `Scheduled for ${start.toLocaleString()}`,
    metadata: {
      calBookingId: calBooking.uid || String(calBooking.id),
    },
  })

  return {
    appointmentId: appointment.id,
    calBookingId: calBooking.uid || String(calBooking.id),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    confirmationMessage: `Your appointment has been scheduled for ${start.toLocaleString('en-US', { timeZone: timezone })}. You will receive a confirmation email shortly.`,
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(
  practiceId: string,
  appointmentId: string
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      practiceId,
    },
  })

  if (!appointment) {
    throw new Error('Appointment not found')
  }

  const isOpenDentalLinked = !!appointment.calBookingId?.startsWith('opendental:')

  // Cancel in Cal.com only for Cal-booked appointments (not Open Dental links).
  if (appointment.calBookingId && !isOpenDentalLinked) {
    try {
      const calClient = await getCalClient(practiceId)
      await calClient.cancelBooking(appointment.calBookingId)
    } catch (error) {
      console.error('Error canceling Cal.com booking:', error)
      // Continue with local cancellation even if Cal.com fails
    }
  }

  // Update local appointment
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'cancelled' },
  })

  // For Open Dental-linked appointments, mark the OD appointment Broken (best-effort).
  if (isOpenDentalLinked) {
    try {
      await writeBackAppointmentToOpenDental({ practiceId, appointmentId })
    } catch (error) {
      console.error('Error canceling Open Dental appointment:', error)
    }
  }

  // Create timeline entry using new activity logging system
  const { logAppointmentActivity } = await import('@/lib/patient-activity')
  await logAppointmentActivity({
    patientId: appointment.patientId,
    appointmentId: appointment.id,
    action: 'cancelled',
    title: 'Appointment cancelled',
    description: `Appointment scheduled for ${appointment.startTime.toLocaleString()} was cancelled`,
  })
}

