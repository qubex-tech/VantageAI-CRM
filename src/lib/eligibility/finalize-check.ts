import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { logPatientActivity } from '@/lib/patient-activity'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { formatUserFacingDateTime } from '@/lib/timezone'
import {
  formatEligibilityNoteContent,
  parseEligibilityResponse,
  type AvailityCoverageRecord,
  type ParsedEligibilitySummary,
} from '@/lib/availity'

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

export async function finalizeEligibilityCheck(params: {
  eligibilityCheckId: string
  coverage: AvailityCoverageRecord
  triggerVoiceFallback?: (checkId: string, reason: string) => Promise<void>
}): Promise<{
  status: 'complete' | 'failed' | 'fallback_voice'
  summary?: ParsedEligibilitySummary
}> {
  const check = await prisma.eligibilityCheck.findUnique({
    where: { id: params.eligibilityCheckId },
    include: {
      policy: true,
      patient: true,
    },
  })

  if (!check) {
    throw new Error('Eligibility check not found')
  }

  const summary = parseEligibilityResponse(params.coverage)
  const statusCode = String(params.coverage.statusCode ?? '')
  const isTerminalError =
    statusCode === '19' ||
    ['7', '13', '14', '15'].includes(statusCode) ||
    summary.eligibilityStatus === 'error'

  if (isTerminalError) {
    const reason =
      summary.validationMessages.join('; ') ||
      params.coverage.status ||
      'Availity eligibility check failed'

    await prisma.eligibilityCheck.update({
      where: { id: check.id },
      data: {
        status: 'failed',
        availityStatusCode: statusCode || null,
        rawResponse: params.coverage as object,
        parsedSummary: summary as object,
        errorMessage: reason,
        completedAt: new Date(),
      },
    })

    if (params.triggerVoiceFallback) {
      await params.triggerVoiceFallback(check.id, reason)
      return { status: 'fallback_voice', summary }
    }

    return { status: 'failed', summary }
  }

  const now = new Date()
  const practiceTimeZone = await getPracticeTimeZone(check.practiceId)
  const noteContent = formatEligibilityNoteContent({
    summary,
    payerNameRaw: check.policy.payerNameRaw,
    checkedAt: now,
  })

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
      eligibilityStatus: summary.eligibilityStatus,
      lastEligibilityCheckedAt: now,
    },
  })

  await prisma.eligibilityCheck.update({
    where: { id: check.id },
    data: {
      status: 'complete',
      availityCoverageId: params.coverage.id || check.availityCoverageId,
      availityStatusCode: statusCode || null,
      rawResponse: params.coverage as object,
      parsedSummary: summary as object,
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
        source: 'availity_eligibility',
        eligibilityCheckId: check.id,
        eligibilityStatus: summary.eligibilityStatus,
      },
    },
  })

  await logPatientActivity({
    patientId: check.patientId,
    type: 'insurance',
    title: 'Insurance eligibility verified (Availity)',
    description: `${summary.eligibilityStatus} — ${formatUserFacingDateTime(now, {
      timeZone: practiceTimeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`,
    metadata: {
      noteId: note.id,
      eligibilityCheckId: check.id,
      eligibilityStatus: summary.eligibilityStatus,
      source: 'availity_api',
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
    console.error('[EligibilityCheck] EHR sync failed (note still saved in CRM):', error)
  }

  return { status: 'complete', summary }
}

export async function markEligibilityCheckFailed(checkId: string, reason: string) {
  await prisma.eligibilityCheck.update({
    where: { id: checkId },
    data: {
      status: 'failed',
      errorMessage: reason,
      completedAt: new Date(),
    },
  })
}

export async function linkVoiceFallbackToCheck(params: {
  checkId: string
  callId: string | null
  conversationId: string
}) {
  await prisma.eligibilityCheck.update({
    where: { id: params.checkId },
    data: {
      status: 'fallback_voice',
      fallbackCallId: params.callId,
      fallbackConversationId: params.conversationId,
      completedAt: new Date(),
    },
  })
}
