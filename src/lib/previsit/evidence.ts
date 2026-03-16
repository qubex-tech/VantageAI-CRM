import { prisma } from '@/lib/db'
import { retrieveKnowledgeBaseMatches } from '@/lib/ai/knowledgeBase'
import type { PreVisitEvidenceItem } from '@/lib/previsit/types'

const MAX_SNIPPET = 320

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, limit = MAX_SNIPPET) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 3)}...`
}

function makeSnippet(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') {
    return truncate(compactWhitespace(value))
  }
  return truncate(compactWhitespace(JSON.stringify(value)))
}

function makeEvidenceItem(item: PreVisitEvidenceItem): PreVisitEvidenceItem {
  return {
    ...item,
    title: truncate(compactWhitespace(item.title), 120),
    snippet: makeSnippet(item.snippet),
  }
}

export async function buildPatientEvidenceBundle({
  practiceId,
  patientId,
}: {
  practiceId: string
  patientId: string
}) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      practiceId,
      deletedAt: null,
    },
    include: {
      patientNotes: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      timelineEntries: {
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
      appointments: {
        orderBy: { startTime: 'desc' },
        take: 15,
      },
      insurancePolicies: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      },
      formSubmissions: {
        orderBy: { submittedAt: 'desc' },
        take: 10,
      },
      documentUploads: {
        orderBy: { uploadedAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!patient) {
    throw new Error('Patient not found')
  }

  const evidence: PreVisitEvidenceItem[] = []

  evidence.push(
    makeEvidenceItem({
      sourceId: `patient:${patient.id}`,
      sourceType: 'patient_profile',
      title: 'Patient Profile',
      snippet: [
        patient.name ? `Name: ${patient.name}` : null,
        patient.dateOfBirth ? `DOB: ${patient.dateOfBirth.toISOString().split('T')[0]}` : null,
        patient.gender ? `Gender: ${patient.gender}` : null,
        patient.primaryLanguage ? `Language: ${patient.primaryLanguage}` : null,
        patient.primaryPhone || patient.phone ? `Phone: ${patient.primaryPhone || patient.phone}` : null,
        patient.email ? `Email: ${patient.email}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
      locator: { patientId: patient.id },
    })
  )

  for (const policy of patient.insurancePolicies) {
    evidence.push(
      makeEvidenceItem({
        sourceId: `insurance:${policy.id}`,
        sourceType: 'insurance',
        title: `Insurance Policy${policy.isPrimary ? ' (Primary)' : ''}`,
        snippet: [
          `Payer: ${policy.payerNameRaw}`,
          `Member ID: ${policy.memberId}`,
          policy.planName ? `Plan: ${policy.planName}` : null,
          policy.planType ? `Type: ${policy.planType}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
        locator: { patientId: patient.id },
      })
    )
  }

  for (const note of patient.patientNotes) {
    evidence.push(
      makeEvidenceItem({
        sourceId: `note:${note.id}`,
        sourceType: 'patient_note',
        title: `Patient Note (${note.type})`,
        snippet: note.content,
        locator: { patientId: patient.id, noteId: note.id },
      })
    )
  }

  for (const timelineEntry of patient.timelineEntries) {
    evidence.push(
      makeEvidenceItem({
        sourceId: `timeline:${timelineEntry.id}`,
        sourceType: 'timeline_entry',
        title: timelineEntry.title,
        snippet: [timelineEntry.description, makeSnippet(timelineEntry.metadata)].filter(Boolean).join(' | '),
        locator: { patientId: patient.id, timelineEntryId: timelineEntry.id },
      })
    )
  }

  for (const appointment of patient.appointments) {
    evidence.push(
      makeEvidenceItem({
        sourceId: `appointment:${appointment.id}`,
        sourceType: 'appointment',
        title: `Appointment (${appointment.visitType})`,
        snippet: [
          `Status: ${appointment.status}`,
          `Start: ${appointment.startTime.toISOString()}`,
          appointment.reason ? `Reason: ${appointment.reason}` : null,
          appointment.notes ? `Notes: ${appointment.notes}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
        locator: { patientId: patient.id, appointmentId: appointment.id },
      })
    )
  }

  for (const submission of patient.formSubmissions) {
    evidence.push(
      makeEvidenceItem({
        sourceId: `form_submission:${submission.id}`,
        sourceType: 'form_submission',
        title: `Form Submission (${submission.formType})`,
        snippet: makeSnippet(submission.formData),
        locator: { patientId: patient.id, formSubmissionId: submission.id },
      })
    )
  }

  for (const documentUpload of patient.documentUploads) {
    evidence.push(
      makeEvidenceItem({
        sourceId: `document_upload:${documentUpload.id}`,
        sourceType: 'document_upload',
        title: documentUpload.fileName,
        snippet: [
          documentUpload.category ? `Category: ${documentUpload.category}` : null,
          documentUpload.fileType ? `Type: ${documentUpload.fileType}` : null,
          documentUpload.fileUrl ? `URL: ${documentUpload.fileUrl}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
        locator: { patientId: patient.id, documentUploadId: documentUpload.id },
      })
    )
  }

  const kbQueryParts = [
    patient.name,
    patient.patientNotes[0]?.content?.slice(0, 120),
    patient.timelineEntries[0]?.title,
  ].filter(Boolean)
  const kbQuery = kbQueryParts.join(' ')

  if (kbQuery) {
    const kbMatches = await retrieveKnowledgeBaseMatches({
      practiceId,
      query: kbQuery,
      limit: 5,
      fallbackToRecent: true,
    })

    for (const match of kbMatches) {
      evidence.push(
        makeEvidenceItem({
          sourceId: `kb:${match.id}`,
          sourceType: 'knowledge_base',
          title: match.title,
          snippet: match.summary || match.snippet || '',
          locator: { patientId: patient.id, kbId: match.id },
        })
      )
    }
  }

  return {
    patientId: patient.id,
    practiceId,
    generatedAt: new Date().toISOString(),
    evidenceItems: evidence,
  }
}
