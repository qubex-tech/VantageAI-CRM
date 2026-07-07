import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

/** Cal.com UID is the stable identifier; numeric id is a legacy alias. */
export function canonicalCalBookingId(
  uid?: string | null,
  id?: string | number | null
): string | null {
  const normalizedUid = uid?.trim()
  if (normalizedUid) return normalizedUid
  if (id == null) return null
  const numeric = String(id).trim()
  return numeric || null
}

/** All stored forms that refer to the same Cal.com booking. */
export function calBookingIdAliases(
  uid?: string | null,
  id?: string | number | null
): string[] {
  const aliases: string[] = []
  const normalizedUid = uid?.trim()
  const numeric = id == null ? '' : String(id).trim()
  if (normalizedUid) aliases.push(normalizedUid)
  if (numeric && !aliases.includes(numeric)) aliases.push(numeric)
  return aliases
}

export function calBookingIdsMatch(
  stored: string | null | undefined,
  uid?: string | null,
  id?: string | number | null
): boolean {
  if (!stored) return false
  return calBookingIdAliases(uid, id).includes(stored)
}

export function calBookingIdOrWhere(
  uid?: string | null,
  id?: string | number | null
): Prisma.AppointmentWhereInput | undefined {
  const aliases = calBookingIdAliases(uid, id)
  if (aliases.length === 0) return undefined
  return { OR: aliases.map((calBookingId) => ({ calBookingId })) }
}

type AppointmentLookupRow = {
  id: string
  practiceId: string
  patientId: string
  calBookingId: string | null
  status: string
  startTime: Date
  endTime: Date
  updatedAt: Date
}

function pickPrimaryCalAppointment(
  appointments: AppointmentLookupRow[],
  uid?: string | null,
  id?: string | number | null
): AppointmentLookupRow {
  const canonical = canonicalCalBookingId(uid, id)
  const byCanonical = canonical
    ? appointments.find((a) => a.calBookingId === canonical)
    : undefined
  if (byCanonical) return byCanonical

  const active = appointments.find((a) => a.status === 'confirmed' || a.status === 'scheduled')
  if (active) return active

  return appointments.reduce((latest, current) =>
    current.updatedAt > latest.updatedAt ? current : latest
  )
}

/**
 * Merge duplicate CRM rows for one Cal.com booking (numeric id vs UID).
 * Keeps the canonical row and deletes the rest.
 */
export async function consolidateCalBookingDuplicates(params: {
  practiceId: string
  uid?: string | null
  id?: string | number | null
}): Promise<{ keptId: string | null; removedIds: string[] }> {
  const where = calBookingIdOrWhere(params.uid, params.id)
  if (!where) return { keptId: null, removedIds: [] }

  const appointments = await prisma.appointment.findMany({
    where: { practiceId: params.practiceId, ...where },
    select: {
      id: true,
      practiceId: true,
      patientId: true,
      calBookingId: true,
      status: true,
      startTime: true,
      endTime: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (appointments.length === 0) return { keptId: null, removedIds: [] }

  const primary = pickPrimaryCalAppointment(appointments, params.uid, params.id)
  const canonical = canonicalCalBookingId(params.uid, params.id)

  if (canonical && primary.calBookingId !== canonical) {
    await prisma.appointment.update({
      where: { id: primary.id },
      data: { calBookingId: canonical },
    })
  }

  const removedIds: string[] = []
  for (const duplicate of appointments) {
    if (duplicate.id === primary.id) continue
    await prisma.appointment.delete({ where: { id: duplicate.id } })
    removedIds.push(duplicate.id)
  }

  return { keptId: primary.id, removedIds }
}

export async function findAppointmentByCalBookingIds(params: {
  practiceId?: string
  uid?: string | null
  id?: string | number | null
  include?: Prisma.AppointmentInclude
}) {
  const bookingWhere = calBookingIdOrWhere(params.uid, params.id)
  if (!bookingWhere) return null

  return prisma.appointment.findFirst({
    where: {
      ...(params.practiceId ? { practiceId: params.practiceId } : {}),
      ...bookingWhere,
    },
    include: params.include,
  })
}

export async function findAppointmentsByCalBookingIds(params: {
  practiceId?: string
  uid?: string | null
  id?: string | number | null
}) {
  const bookingWhere = calBookingIdOrWhere(params.uid, params.id)
  if (!bookingWhere) return []

  return prisma.appointment.findMany({
    where: {
      ...(params.practiceId ? { practiceId: params.practiceId } : {}),
      ...bookingWhere,
    },
    include: { patient: true },
  })
}

/** True when a local appointment row already represents this Cal.com booking. */
export function localAppointmentMatchesCalBooking(
  calBookingId: string | null | undefined,
  booking: { uid?: string | null; id?: string | number | null }
): boolean {
  return calBookingIdsMatch(calBookingId, booking.uid, booking.id)
}

export function calBookingAlreadyInLocalAppointments(
  localAppointments: Array<{ calBookingId?: string | null }>,
  booking: { uid?: string | null; id?: string | number | null }
): boolean {
  return localAppointments.some((apt) =>
    localAppointmentMatchesCalBooking(apt.calBookingId, booking)
  )
}
