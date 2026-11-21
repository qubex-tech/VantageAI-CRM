import { prisma } from '@/lib/db'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import type { PatientNoteEhrSyncResult } from '@/lib/integrations/ehr/patientNoteSync'
import type { ParsedEligibilitySummary } from '@/lib/availity'
import { formatEligibilityNoteContent } from '@/lib/availity'
import {
  ehrDisplayFields,
  formatDisplayFieldLines,
} from '@/lib/eligibility/display-fields'
import { formatPatientDob } from '@/lib/mcp/verification-fields'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { formatUserFacingDateTime } from '@/lib/timezone'

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
  const selected = formatDisplayFieldLines(ehrDisplayFields(params.summary.displaySnapshot))
  if (selected.length > 0) {
    return formatSelectedFieldsBillingNote(params, selected)
  }

  return formatEligibilityNoteContent({
    summary: params.summary,
    payerNameRaw: params.payerNameRaw || undefined,
    checkedAt: params.checkedAt,
    sourceLabel: params.sourceLabel,
    timeZone: params.timeZone,
    patientName: params.patient ? patientDisplayName(params.patient) : undefined,
    patientDob: formatPatientDob(params.patient?.dateOfBirth) || undefined,
    memberId: params.policy?.memberId || undefined,
    groupNumber: params.policy?.groupNumber || undefined,
    planName: params.policy?.planName || undefined,
    planType: params.policy?.planType || undefined,
    isPrimary: params.policy?.isPrimary ?? undefined,
  })
}

function formatSelectedFieldsBillingNote(
  params: Parameters<typeof formatEligibilityBillingNote>[0],
  selectedLines: string[]
): string {
  const lines: string[] = [
    params.sourceLabel
      ? `Eligibility / Billing Note (${params.sourceLabel})`
      : 'Eligibility / Billing Note',
  ]
  if (params.checkedAt) {
    lines.push(
      `Checked: ${formatUserFacingDateTime(params.checkedAt, {
        timeZone: params.timeZone,
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`
    )
  }
  lines.push(
    `Status: ${params.summary.eligibilityStatus.charAt(0).toUpperCase()}${params.summary.eligibilityStatus.slice(1)}`
  )
  const patientName = params.patient ? patientDisplayName(params.patient) : undefined
  if (patientName) lines.push(`Patient: ${patientName}`)
  const dob = formatPatientDob(params.patient?.dateOfBirth)
  if (dob) lines.push(`Date of birth: ${dob}`)
  if (params.policy?.memberId) lines.push(`Member ID: ${params.policy.memberId}`)
  const payer = params.summary.payerName || params.payerNameRaw
  if (payer) lines.push(`Payer: ${payer}`)
  lines.push('')
  lines.push(...selectedLines)
  return lines.join('\n')
}

export async function findRelatedEligibilityVisit(params: {
  practiceId: string
  patientId: string
  timeZone?: string
}): Promise<{ line: string; startTime: Date; visitType: string } | null> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 18 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
  const appointment = await prisma.appointment.findFirst({
    where: {
      practiceId: params.practiceId,
      patientId: params.patientId,
      status: { in: ['scheduled', 'confirmed'] },
      startTime: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { startTime: 'asc' },
    select: { startTime: true, visitType: true, timezone: true },
  })
  if (!appointment) return null
  const timeZone = params.timeZone || appointment.timezone
  const when = formatUserFacingDateTime(appointment.startTime, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return {
    line: `Related visit: ${when} (${appointment.visitType})`,
    startTime: appointment.startTime,
    visitType: appointment.visitType,
  }
}

export async function persistEligibilityBillingNote(params: {
  practiceId: string
  patientId: string
  actorUserId: string
  content: string
}): Promise<{ noteId: string; ehrSync: PatientNoteEhrSyncResult }> {
  const timeZone = await getPracticeTimeZone(params.practiceId)
  const relatedVisit = await findRelatedEligibilityVisit({
    practiceId: params.practiceId,
    patientId: params.patientId,
    timeZone,
  })
  const content = relatedVisit ? `${relatedVisit.line}\n${params.content}` : params.content

  const note = await prisma.patientNote.create({
    data: {
      patientId: params.patientId,
      practiceId: params.practiceId,
      userId: params.actorUserId,
      type: ELIGIBILITY_BILLING_NOTE_TYPE,
      content,
    },
  })

  let ehrSync: PatientNoteEhrSyncResult
  try {
    ehrSync = await syncPatientNoteToEhr({
      practiceId: params.practiceId,
      patientId: params.patientId,
      noteType: ELIGIBILITY_BILLING_NOTE_TYPE,
      content,
      actorUserId: params.actorUserId,
      forceMode: 'telephone_encounter',
    })
    if (ehrSync.status !== 'success') {
      console.error('[EligibilityBillingNote] EHR sync did not succeed', {
        practiceId: params.practiceId,
        patientId: params.patientId,
        noteId: note.id,
        ehrSync,
      })
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'eligibility_billing_ehr_sync_failed'
    console.error('[EligibilityBillingNote] EHR sync failed (note still saved in CRM):', error)
    ehrSync = { status: 'error', mode: 'telephone_encounter', reason }
  }

  return { noteId: note.id, ehrSync }
}
