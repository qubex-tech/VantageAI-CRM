import { prisma } from '@/lib/db'
import { loadAriaPatientContext } from '@/lib/aria/context'
import type { GlassesChartInput } from '@/lib/glasses/types'

export class GlassesPatientNotFound extends Error {
  constructor() {
    super('Patient not found')
    this.name = 'GlassesPatientNotFound'
  }
}

export async function loadGlassesChartInput(params: {
  practiceId: string
  patientId: string
  appointmentId?: string | null
}): Promise<GlassesChartInput> {
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, practiceId: params.practiceId, deletedAt: null },
    select: {
      name: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      tags: { select: { tag: true }, take: 20 },
    },
  })
  if (!patient) throw new GlassesPatientNotFound()

  const patientName =
    [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || patient.name

  const appointment = params.appointmentId
    ? await prisma.appointment.findFirst({
        where: {
          id: params.appointmentId,
          practiceId: params.practiceId,
          patientId: params.patientId,
        },
        select: { visitType: true, reason: true, startTime: true, timezone: true },
      })
    : await pickAppointment(params.practiceId, params.patientId)

  const notes = await prisma.patientNote.findMany({
    where: { practiceId: params.practiceId, patientId: params.patientId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { type: true, content: true, createdAt: true },
  })

  const aria = await loadAriaPatientContext({
    practiceId: params.practiceId,
    patientId: params.patientId,
    appointmentId: params.appointmentId,
  })

  return {
    patientName,
    dateOfBirth: patient.dateOfBirth,
    visitType: appointment?.visitType ?? aria.visitType,
    reason: appointment?.reason ?? aria.reason,
    appointmentStart: appointment?.startTime ?? null,
    timeZone: appointment?.timezone ?? null,
    notes,
    snippets: aria.snippets,
    tags: patient.tags.map((tag) => tag.tag),
  }
}

async function pickAppointment(practiceId: string, patientId: string) {
  const now = new Date()
  const upcoming = await prisma.appointment.findFirst({
    where: {
      practiceId,
      patientId,
      startTime: { gte: now },
      status: { notIn: ['cancelled', 'no_show'] },
    },
    orderBy: { startTime: 'asc' },
    select: { visitType: true, reason: true, startTime: true, timezone: true },
  })
  if (upcoming) return upcoming
  return prisma.appointment.findFirst({
    where: {
      practiceId,
      patientId,
      status: { not: 'cancelled' },
    },
    orderBy: { startTime: 'desc' },
    select: { visitType: true, reason: true, startTime: true, timezone: true },
  })
}
