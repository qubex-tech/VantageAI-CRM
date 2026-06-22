import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { logPatientActivity } from '@/lib/patient-activity'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import type { ExtractedCallData } from '@/lib/process-call-data'
import type { RetellCall } from '@/lib/retell-api'
import type { Prisma } from '@prisma/client'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { formatUserFacingDateTime } from '@/lib/timezone'

export type InsuranceVerificationData = NonNullable<ExtractedCallData['insurance_verification']>

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asNonEmptyString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text.length > 0 ? text : undefined
}

export function formatInsuranceVerificationNoteContent(params: {
  callId?: string
  verification: InsuranceVerificationData
  callSummary?: string
  verifiedAt?: Date
  timeZone?: string
}): string {
  const { callId, verification, callSummary, verifiedAt, timeZone } = params
  const lines: string[] = ['Insurance Verification']

  if (callId) lines.push(`Retell Call ID: ${callId}`)
  if (verifiedAt) {
    lines.push(
      `Verified at: ${formatUserFacingDateTime(verifiedAt, { timeZone, dateStyle: 'medium', timeStyle: 'short' })}`
    )
  }

  const summary = (verification.summary || callSummary || '').trim()
  if (summary) {
    lines.push('')
    lines.push('Summary')
    lines.push(summary)
  }

  const status: string[] = []
  if (verification.sentiment) status.push(`Sentiment: ${verification.sentiment}`)
  if (verification.call_successful) status.push(`Call Successful: ${verification.call_successful}`)
  if (verification.voicemail) status.push(`Voicemail: ${verification.voicemail}`)
  if (status.length > 0) {
    lines.push('')
    for (const line of status) lines.push(line)
  }

  const fields = verification.fields || []
  if (fields.length > 0) {
    lines.push('')
    lines.push('Extracted Data')
    for (const field of fields) {
      lines.push(`- ${field.label}: ${field.value}`)
    }
  }

  return lines.join('\n')
}

async function getOrCreateAutomationUserId(practiceId: string): Promise<string> {
  const email = `automation+${practiceId}@getvantage.tech`
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existing) return existing.id

  const passwordHash = await bcrypt.hash(`${practiceId}-${Date.now()}-automation`, 10)
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Automation',
      role: 'admin',
      practiceId,
    },
    select: { id: true },
  })

  return created.id
}

export async function resolvePatientIdForInsuranceVerificationCall(params: {
  practiceId: string
  call: RetellCall
  extractedData: ExtractedCallData
  knownPatientId?: string | null
}): Promise<string | null> {
  const { practiceId, call, extractedData, knownPatientId } = params

  if (knownPatientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: knownPatientId, practiceId, deletedAt: null },
      select: { id: true },
    })
    if (patient) return patient.id
  }

  const metadata = metadataObject(call.metadata)
  const metadataPatientId =
    asNonEmptyString(metadata.patient_id) ||
    asNonEmptyString(metadataObject(metadata.patient).id)
  if (metadataPatientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: metadataPatientId, practiceId, deletedAt: null },
      select: { id: true },
    })
    if (patient) return patient.id
  }

  if (call.call_id) {
    const conversation = await prisma.voiceConversation.findFirst({
      where: { practiceId, retellCallId: call.call_id },
      select: { patientId: true },
    })
    if (conversation?.patientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: conversation.patientId, practiceId, deletedAt: null },
        select: { id: true },
      })
      if (patient) return patient.id
    }
  }

  const verification = extractedData.insurance_verification
  if (verification?.patient_first_name && verification?.patient_last_name) {
    const dobText = verification.patient_dob?.trim()
    const patients = await prisma.patient.findMany({
      where: {
        practiceId,
        deletedAt: null,
        OR: [
          {
            firstName: { equals: verification.patient_first_name, mode: 'insensitive' },
            lastName: { equals: verification.patient_last_name, mode: 'insensitive' },
          },
          {
            name: {
              contains: `${verification.patient_first_name} ${verification.patient_last_name}`.trim(),
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { id: true, dateOfBirth: true },
      take: 5,
    })

    if (patients.length === 1) {
      return patients[0].id
    }

    if (patients.length > 1 && dobText) {
      const dobMatch = patients.find((patient) => {
        if (!patient.dateOfBirth) return false
        const stored = patient.dateOfBirth.toISOString().slice(0, 10)
        return stored === dobText || stored.startsWith(dobText.slice(0, 10))
      })
      if (dobMatch) return dobMatch.id
    }
  }

  return null
}

export type PersistInsuranceVerificationNoteResult =
  | { status: 'created'; noteId: string; patientId: string }
  | { status: 'skipped'; reason: string; patientId?: string }
  | { status: 'error'; reason: string; patientId?: string }

export async function persistInsuranceVerificationNote(params: {
  practiceId: string
  call: RetellCall
  extractedData: ExtractedCallData
  knownPatientId?: string | null
}): Promise<PersistInsuranceVerificationNoteResult> {
  const { practiceId, call, extractedData, knownPatientId } = params
  const verification = extractedData.insurance_verification

  if (!verification) {
    return { status: 'skipped', reason: 'no_insurance_verification_data' }
  }

  const hasCapturedField =
    (verification.fields?.length ?? 0) > 0 ||
    Boolean(verification.summary || verification.sentiment || verification.call_successful || verification.voicemail)
  if (!hasCapturedField) {
    return { status: 'skipped', reason: 'empty_insurance_verification_data' }
  }

  const patientId = await resolvePatientIdForInsuranceVerificationCall({
    practiceId,
    call,
    extractedData,
    knownPatientId,
  })

  if (!patientId) {
    console.warn('[InsuranceVerificationNote] Unable to resolve patient for insurance verification note', {
      practiceId,
      callId: call.call_id,
    })
    return { status: 'skipped', reason: 'patient_not_resolved' }
  }

  const callId = call.call_id || undefined
  let conversation = callId
    ? await prisma.voiceConversation.findFirst({
        where: { practiceId, retellCallId: callId },
        select: { id: true, metadata: true, outcome: true },
      })
    : null

  const conversationMetadata = metadataObject(conversation?.metadata)
  const existingNoteId = asNonEmptyString(conversationMetadata.insuranceVerificationNoteId)
  if (existingNoteId) {
    const existingNote = await prisma.patientNote.findFirst({
      where: {
        id: existingNoteId,
        patientId,
        practiceId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (existingNote) {
      return { status: 'skipped', reason: 'note_already_created', patientId }
    }
  }

  const practiceTimeZone = await getPracticeTimeZone(practiceId)
  const noteContent = formatInsuranceVerificationNoteContent({
    callId,
    verification,
    callSummary: extractedData.call_summary || extractedData.detailed_call_summary,
    verifiedAt: call.end_timestamp ? new Date(call.end_timestamp) : new Date(),
    timeZone: practiceTimeZone,
  })

  const automationUserId = await getOrCreateAutomationUserId(practiceId)

  try {
    const note = await prisma.patientNote.create({
      data: {
        patientId,
        practiceId,
        userId: automationUserId,
        type: 'insurance',
        content: noteContent,
      },
    })

    await createAuditLog({
      practiceId,
      userId: automationUserId,
      action: 'create',
      resourceType: 'patient',
      resourceId: patientId,
      changes: {
        after: {
          source: 'retell_insurance_verification',
          callId: callId || null,
          noteId: note.id,
          noteType: 'insurance',
        },
      },
    })

    await logPatientActivity({
      patientId,
      type: 'insurance',
      title: 'Insurance verification completed',
      description: noteContent.length > 500 ? `${noteContent.slice(0, 500)}...` : noteContent,
      metadata: {
        noteId: note.id,
        retellCallId: callId || null,
        source: 'retell_insurance_verification',
        capturedFieldLabels: (verification.fields || []).map((f) => f.label),
      },
      userId: automationUserId,
    })

    if (conversation) {
      conversation = await prisma.voiceConversation.update({
        where: { id: conversation.id },
        data: {
          patientId,
          outcome: 'insurance_verification_completed',
          metadata: {
            ...conversationMetadata,
            insuranceVerificationNoteId: note.id,
            insuranceVerificationCapturedAt: new Date().toISOString(),
            insurance_verification: verification as unknown as Prisma.InputJsonObject,
          } as Prisma.InputJsonObject,
        },
        select: { id: true, metadata: true, outcome: true },
      })
    }

    try {
      await syncPatientNoteToEhr({
        practiceId,
        patientId,
        noteType: 'insurance',
        content: noteContent,
        actorUserId: automationUserId,
      })
    } catch (error) {
      console.error('[InsuranceVerificationNote] EHR sync failed (note still saved in CRM):', error)
    }

    console.info('[InsuranceVerificationNote] Created insurance verification note', {
      practiceId,
      patientId,
      noteId: note.id,
      callId: callId || null,
      capturedFieldCount: (verification.fields || []).length,
    })

    return { status: 'created', noteId: note.id, patientId }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'note_creation_failed'
    console.error('[InsuranceVerificationNote] Failed to create note', {
      practiceId,
      patientId,
      callId: callId || null,
      reason,
    })
    return { status: 'error', reason, patientId }
  }
}
