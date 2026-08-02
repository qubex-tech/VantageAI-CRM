import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { logPatientActivity } from '@/lib/patient-activity'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { formatUserFacingDateTime } from '@/lib/timezone'
import {
  formatEligibilityNoteContent,
  type ParsedEligibilitySummary,
} from '@/lib/availity'
import { applyCallRequiredFlag } from '@/lib/eligibility/lsr-gates'

async function getOrCreateAutomationUserId(practiceId: string): Promise<string> {
  const email = `automation+${practiceId}@getvantage.tech`
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
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

function isParsedSummary(value: unknown): value is ParsedEligibilitySummary {
  if (!value || typeof value !== 'object') return false
  const status = (value as ParsedEligibilitySummary).eligibilityStatus
  return status === 'active' || status === 'inactive' || status === 'unknown' || status === 'error'
}

export async function finalizeRpaEligibilityCheck(params: {
  eligibilityCheckId: string
  summary: ParsedEligibilitySummary
  rawOutput?: Record<string, unknown>
  browserAgentRunId?: string
  appointmentType?: string
}): Promise<{ status: 'complete' | 'failed'; summary: ParsedEligibilitySummary }> {
  const check = await prisma.eligibilityCheck.findUnique({
    where: { id: params.eligibilityCheckId },
    include: { policy: true, patient: true },
  })
  if (!check) throw new Error('Eligibility check not found')

  if (params.summary.rheum) {
    const appt =
      params.appointmentType ||
      (typeof (params.rawOutput as { appointmentType?: string } | undefined)?.appointmentType ===
      'string'
        ? (params.rawOutput as { appointmentType?: string }).appointmentType
        : undefined)
    if (appt) {
      params.summary.rheum = applyCallRequiredFlag(params.summary.rheum, appt)
    }
  }

  if (params.summary.eligibilityStatus === 'error') {
    await prisma.eligibilityCheck.update({
      where: { id: check.id },
      data: {
        status: 'failed',
        rawResponse: (params.rawOutput || params.summary) as object,
        parsedSummary: params.summary as object,
        errorMessage: params.summary.validationMessages?.join('; ') || 'RPA eligibility error',
        completedAt: new Date(),
      },
    })
    return { status: 'failed', summary: params.summary }
  }

  const now = new Date()
  const practiceTimeZone = await getPracticeTimeZone(check.practiceId)
  const noteContent = formatEligibilityNoteContent({
    summary: params.summary,
    payerNameRaw: check.policy.payerNameRaw,
    checkedAt: now,
  }).replace('Insurance Eligibility (Availity)', 'Insurance Eligibility (Availity Portal)')

  const automationUserId = await getOrCreateAutomationUserId(check.practiceId)

  const note = await prisma.patientNote.create({
    data: {
      patientId: check.patientId,
      practiceId: check.practiceId,
      userId: automationUserId,
      type: 'insurance',
      content: noteContent,
    },
  })

  await prisma.insurancePolicy.update({
    where: { id: check.policyId },
    data: {
      eligibilityStatus: params.summary.eligibilityStatus,
      lastEligibilityCheckedAt: now,
    },
  })

  await prisma.eligibilityCheck.update({
    where: { id: check.id },
    data: {
      status: 'complete',
      rawResponse: (params.rawOutput || params.summary) as object,
      parsedSummary: params.summary as object,
      completedAt: now,
    },
  })

  await createAuditLog({
    practiceId: check.practiceId,
    userId: automationUserId,
    action: 'update',
    resourceType: 'insurance',
    resourceId: check.policyId,
    changes: {
      after: {
        source: 'availity_rpa',
        eligibilityCheckId: check.id,
        browserAgentRunId: params.browserAgentRunId,
        eligibilityStatus: params.summary.eligibilityStatus,
      },
    },
  })

  await logPatientActivity({
    patientId: check.patientId,
    type: 'insurance',
    title: 'Insurance eligibility verified (Availity portal)',
    description: `${params.summary.eligibilityStatus} — ${formatUserFacingDateTime(now, {
      timeZone: practiceTimeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`,
    metadata: {
      noteId: note.id,
      eligibilityCheckId: check.id,
      eligibilityStatus: params.summary.eligibilityStatus,
      source: 'availity_rpa',
      browserAgentRunId: params.browserAgentRunId,
    },
    userId: automationUserId,
  })

  try {
    await syncPatientNoteToEhr({
      practiceId: check.practiceId,
      patientId: check.patientId,
      noteType: 'insurance',
      content: noteContent,
      actorUserId: automationUserId,
    })
  } catch (error) {
    console.error('[EligibilityCheck] EHR sync failed after RPA (note still saved):', error)
  }

  return { status: 'complete', summary: params.summary }
}

export function extractSummaryFromPlaybookOutput(
  output: Record<string, unknown> | null | undefined
): ParsedEligibilitySummary | null {
  if (!output) return null
  if (isParsedSummary(output.summary)) return output.summary
  if (isParsedSummary(output)) return output
  return null
}
