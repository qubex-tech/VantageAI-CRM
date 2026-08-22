import { prisma } from '@/lib/db'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import type { PatientNoteEhrSyncResult } from '@/lib/integrations/ehr/patientNoteSync'
import type { ParsedEligibilitySummary } from '@/lib/availity'
import { formatEligibilityNoteContent } from '@/lib/availity'

export const ELIGIBILITY_BILLING_NOTE_TYPE = 'billing' as const

export function patientDisplayName(patient: {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
}): string | undefined {
  const firstLast = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim()
  const name = firstLast || patient.name?.trim()
  return name || undefined
}

export function formatEligibilityBillingNote(params: {
  summary: ParsedEligibilitySummary
  payerNameRaw?: string | null
  checkedAt?: Date
  sourceLabel?: string | null
  timeZone?: string
  patient?: {
    name?: string | null
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
  } | null
  policy?: {
    memberId?: string | null
    groupNumber?: string | null
    planName?: string | null
    planType?: string | null
    isPrimary?: boolean | null
  } | null
}): string {
  return formatEligibilityNoteContent({
    summary: params.summary,
    payerNameRaw: params.payerNameRaw || undefined,
    checkedAt: params.checkedAt,
    sourceLabel: params.sourceLabel,
    timeZone: params.timeZone,
    patientName: params.patient ? patientDisplayName(params.patient) : undefined,
    patientDob: params.patient?.dateOfBirth || undefined,
    memberId: params.policy?.memberId || undefined,
    groupNumber: params.policy?.groupNumber || undefined,
    planName: params.policy?.planName || undefined,
    planType: params.policy?.planType || undefined,
    isPrimary: params.policy?.isPrimary ?? undefined,
  })
}

export async function persistEligibilityBillingNote(params: {
  practiceId: string
  patientId: string
  actorUserId: string
  content: string
}): Promise<{ noteId: string; ehrSync: PatientNoteEhrSyncResult }> {
  const note = await prisma.patientNote.create({
    data: {
      patientId: params.patientId,
      practiceId: params.practiceId,
      userId: params.actorUserId,
      type: ELIGIBILITY_BILLING_NOTE_TYPE,
      content: params.content,
    },
  })

  let ehrSync: PatientNoteEhrSyncResult
  try {
    ehrSync = await syncPatientNoteToEhr({
      practiceId: params.practiceId,
      patientId: params.patientId,
      noteType: ELIGIBILITY_BILLING_NOTE_TYPE,
      content: params.content,
      actorUserId: params.actorUserId,
      forceMode: 'document_reference',
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'eligibility_billing_ehr_sync_failed'
    console.error('[EligibilityBillingNote] EHR sync failed (note still saved in CRM):', error)
    ehrSync = { status: 'error', mode: 'document_reference', reason }
  }

  return { noteId: note.id, ehrSync }
}
