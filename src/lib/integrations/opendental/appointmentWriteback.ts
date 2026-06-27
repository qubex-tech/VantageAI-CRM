import { prisma } from '@/lib/db'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { getOpenDentalServices, getOpenDentalConnection } from './factory'
import { logOpenDentalAudit } from './audit'
import { extractPatNumFromExternalId, formatOpenDentalLocalDateTime } from './commlogWriteback'
import { buildAppointmentExternalId } from './appointmentSync'

const APPT_PREFIX = 'opendental:apt:'
/** Each 'X' in an Open Dental Pattern is a 5-minute slot. */
const PATTERN_SLOT_MINUTES = 5

export type AppointmentWritebackResult = {
  status: 'skipped' | 'success' | 'error'
  reason?: string
  operation?: 'create' | 'update'
  aptNum?: number
}

/** Cache of resolved default operatory per practice (avoids re-listing on every write). */
const operatoryCache = new Map<string, number>()

function extractAptNum(calBookingId: string | null | undefined): number | null {
  if (!calBookingId || !calBookingId.startsWith(APPT_PREFIX)) return null
  const n = Number(calBookingId.slice(APPT_PREFIX.length))
  return Number.isInteger(n) && n > 0 ? n : null
}

function durationToPattern(start: Date, end: Date): string {
  const minutes = Math.max(PATTERN_SLOT_MINUTES, Math.round((end.getTime() - start.getTime()) / 60000))
  const slots = Math.max(1, Math.round(minutes / PATTERN_SLOT_MINUTES))
  return 'X'.repeat(slots)
}

function resolveProvNum(providerId: string | null | undefined): number | undefined {
  if (!providerId) return undefined
  const m = providerId.match(/^prov:(\d+)$/)
  return m ? Number(m[1]) : undefined
}

/** Map a CRM appointment status to an Open Dental AptStatus. */
function mapStatusToApt(status: string): 'Scheduled' | 'Complete' | 'Broken' {
  const s = status.toLowerCase()
  if (s === 'completed') return 'Complete'
  if (s === 'cancelled' || s === 'canceled' || s === 'no_show') return 'Broken'
  return 'Scheduled'
}

async function resolveOperatoryNum(
  practiceId: string,
  services: Awaited<ReturnType<typeof getOpenDentalServices>>,
  connection: { capabilityMetadata?: unknown }
): Promise<number | null> {
  const cached = operatoryCache.get(practiceId)
  if (cached) return cached

  const meta =
    connection.capabilityMetadata && typeof connection.capabilityMetadata === 'object'
      ? (connection.capabilityMetadata as Record<string, unknown>)
      : {}
  const configured = Number(meta.defaultOperatoryNum)
  if (Number.isInteger(configured) && configured > 0) {
    operatoryCache.set(practiceId, configured)
    return configured
  }

  const ops = (await services.operatories.list()) as Array<Record<string, unknown>>
  if (Array.isArray(ops) && ops.length > 0) {
    const active =
      ops.find((o) => String(o.IsHidden).toLowerCase() !== 'true') ?? ops[0]
    const opNum = Number(active?.OperatoryNum)
    if (Number.isInteger(opNum) && opNum > 0) {
      operatoryCache.set(practiceId, opNum)
      return opNum
    }
  }
  return null
}

/**
 * Push a CRM appointment to Open Dental (create, update, or cancel as Broken).
 *
 * Self-gating: skips when the practice has no active Open Dental connection or the
 * patient is not an Open Dental patient. Idempotent via the appointment's
 * `calBookingId` (`opendental:apt:{AptNum}`):
 *  - linked to Open Dental  -> PUT update (time / status / note)
 *  - no external link       -> POST create, then store the AptNum link
 *  - linked to another system (e.g. Cal.com) -> skip to avoid clobbering the link
 */
export async function writeBackAppointmentToOpenDental(params: {
  practiceId: string
  appointmentId: string
  actorUserId?: string
}): Promise<AppointmentWritebackResult> {
  const { practiceId, appointmentId, actorUserId } = params

  const connection = await getOpenDentalConnection(practiceId)
  if (!connection || !connection.isActive) {
    return { status: 'skipped', reason: 'opendental_not_configured' }
  }

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, practiceId },
    include: { patient: { select: { externalEhrId: true } } },
  })
  if (!appt) return { status: 'skipped', reason: 'appointment_not_found' }

  const patNum = extractPatNumFromExternalId(appt.patient?.externalEhrId)
  if (!patNum) return { status: 'skipped', reason: 'patient_not_linked_to_opendental' }

  const existingAptNum = extractAptNum(appt.calBookingId)
  // calBookingId set but not an Open Dental link => booked via another system (Cal.com).
  if (!existingAptNum && appt.calBookingId) {
    return { status: 'skipped', reason: 'linked_to_other_system' }
  }

  const services = await getOpenDentalServices(practiceId)
  const timeZone = await getPracticeTimeZone(practiceId)
  const aptDateTime = formatOpenDentalLocalDateTime(appt.startTime, timeZone)
  const aptStatus = mapStatusToApt(appt.status)
  const provNum = resolveProvNum(appt.providerId)
  const note = appt.notes || appt.reason || undefined

  try {
    if (existingAptNum) {
      const body: Record<string, unknown> = {
        AptDateTime: aptDateTime,
        AptStatus: aptStatus,
      }
      if (provNum) body.ProvNum = provNum
      if (note) body.Note = note
      await services.appointments.update(existingAptNum, body)

      await logOpenDentalAudit({
        tenantId: practiceId,
        actorUserId,
        action: 'appointment.writeback_updated',
        entity: 'Appointment',
        entityId: String(existingAptNum),
        metadata: { appointmentId, aptDateTime, aptStatus, timeZone },
      })
      return { status: 'success', operation: 'update', aptNum: existingAptNum }
    }

    // No Open Dental link yet — don't create a cancelled appointment.
    if (aptStatus === 'Broken') {
      return { status: 'skipped', reason: 'cancelled_not_in_opendental' }
    }

    const op = await resolveOperatoryNum(practiceId, services, connection)
    if (!op) return { status: 'skipped', reason: 'no_operatory' }

    const body: Record<string, unknown> = {
      PatNum: patNum,
      Op: op,
      AptDateTime: aptDateTime,
      Pattern: durationToPattern(appt.startTime, appt.endTime),
      AptStatus: aptStatus,
    }
    if (provNum) body.ProvNum = provNum
    if (note) body.Note = note

    const created = (await services.appointments.create(body)) as Record<string, unknown> | null
    const aptNum = Number(created?.AptNum)
    if (Number.isInteger(aptNum) && aptNum > 0) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { calBookingId: buildAppointmentExternalId(aptNum) },
      })
      await logOpenDentalAudit({
        tenantId: practiceId,
        actorUserId,
        action: 'appointment.writeback_created',
        entity: 'Appointment',
        entityId: String(aptNum),
        metadata: { appointmentId, aptDateTime, aptStatus, op, timeZone },
      })
      return { status: 'success', operation: 'create', aptNum }
    }

    return { status: 'error', reason: 'missing_apt_num_in_response' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Appointment writeback failed'
    return { status: 'error', reason: message }
  }
}
