import { prisma } from '@/lib/db'
import type { AriaContextSnippet } from '@/lib/aria/generate'

export type AriaPatientContext = {
  patientName: string
  visitType: string | null
  reason: string | null
  snippets: AriaContextSnippet[]
}

export async function loadAriaPatientContext(params: {
  practiceId: string
  patientId: string
  appointmentId?: string | null
}): Promise<AriaPatientContext> {
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, practiceId: params.practiceId, deletedAt: null },
    select: {
      name: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      notes: true,
    },
  })

  if (!patient) {
    throw new Error('Patient not found')
  }

  const patientName =
    [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || patient.name

  const snippets: AriaContextSnippet[] = []

  if (patient.dateOfBirth) {
    snippets.push({
      label: 'Demographics',
      text: `DOB: ${patient.dateOfBirth.toISOString().slice(0, 10)}${patient.gender ? `; Gender: ${patient.gender}` : ''}`,
    })
  }
  if (patient.notes?.trim()) {
    snippets.push({ label: 'Profile notes', text: patient.notes.trim().slice(0, 800) })
  }

  let visitType: string | null = null
  let reason: string | null = null

  if (params.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: params.appointmentId,
        practiceId: params.practiceId,
        patientId: params.patientId,
      },
      select: { visitType: true, reason: true, notes: true, startTime: true },
    })
    if (appointment) {
      visitType = appointment.visitType
      reason = appointment.reason
      snippets.push({
        label: 'Appointment',
        text: `${appointment.visitType} at ${appointment.startTime.toISOString()}${
          appointment.reason ? `; Reason: ${appointment.reason}` : ''
        }${appointment.notes ? `; Notes: ${appointment.notes}` : ''}`.slice(0, 800),
      })
    }
  }

  const recentNotes = await prisma.patientNote.findMany({
    where: { practiceId: params.practiceId, patientId: params.patientId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { type: true, content: true, createdAt: true },
  })

  for (const note of recentNotes) {
    snippets.push({
      label: `Recent note (${note.type})`,
      text: note.content.slice(0, 600),
    })
  }

  const preVisit = await prisma.preVisitChart.findFirst({
    where: { practiceId: params.practiceId, patientId: params.patientId, status: 'generated' },
    orderBy: { updatedAt: 'desc' },
    select: { generatedSections: true, chartType: true },
  })

  if (preVisit?.generatedSections) {
    const sections = preVisit.generatedSections as Array<{ title?: string; content?: string }>
    if (Array.isArray(sections)) {
      for (const section of sections.slice(0, 4)) {
        if (section?.content) {
          snippets.push({
            label: `Pre-visit: ${section.title || preVisit.chartType}`,
            text: String(section.content).slice(0, 600),
          })
        }
      }
    }
  }

  return { patientName, visitType, reason, snippets }
}
