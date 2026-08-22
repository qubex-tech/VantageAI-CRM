import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { logPatientActivity } from '@/lib/patient-activity'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { formatUserFacingDateTime } from '@/lib/timezone'
import {
  parseEligibilityResponse,
  type AvailityCoverageRecord,
  type ParsedEligibilitySummary,
} from '@/lib/availity'
import {
  formatEligibilityBillingNote,
  persistEligibilityBillingNote,
} from './eligibility-billing-note'
import { applyCallRequiredFlag } from './lsr-gates'

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

export async function finalizeParsedEligibilityCheck(params: {
  eligibilityCheckId: string
  summary: ParsedEligibilitySummary
  rawResponse: Record<string, unknown>
  externalId?: string | null
  statusCode?: string | null
  sourceLabel?: string | null
  isTerminalError?: boolean
  triggerVoiceFallback?: (checkId: string, reason: string) => Promise<void>
  appointmentType?: string
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

  const summary = { ...params.summary }
  if (summary.rheum && params.appointmentType) {
    summary.rheum = applyCallRequiredFlag(summary.rheum, params.appointmentType)
  }

  const sourceLabel = params.sourceLabel === undefined ? 'Clearinghouse' : params.sourceLabel
  const isTerminalError = Boolean(params.isTerminalError || summary.eligibilityStatus === 'error')

  if (isTerminalError) {
    const reason =
      summary.validationMessages.join('; ') ||
      (sourceLabel ? `${sourceLabel} eligibility check failed` : 'Eligibility check failed')

    await prisma.eligibilityCheck.update({
      where: { id: check.id },
      data: {
        status: 'failed',
        availityCoverageId: params.externalId || check.availityCoverageId,
        availityStatusCode: params.statusCode || null,
        rawResponse: params.rawResponse as object,
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
  const noteContent = formatEligibilityBillingNote({
    summary,
    payerNameRaw: check.policy.payerNameRaw,
    checkedAt: now,
    sourceLabel,
    timeZone: practiceTimeZone,
    patient: check.patient,
    policy: check.policy,
  })

  const automationUserId = await getOrCreateAutomationUserId(check.practiceId)

  const { noteId } = await persistEligibilityBillingNote({
    practiceId: check.practiceId,
    patientId: check.patientId,
    actorUserId: automationUserId,
    content: noteContent,
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
      availityCoverageId: params.externalId || check.availityCoverageId,
      availityStatusCode: params.statusCode || null,
      rawResponse: params.rawResponse as object,
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
        source: 'clearinghouse_eligibility',
        vendorKey: check.vendorKey,
        eligibilityCheckId: check.id,
        eligibilityStatus: summary.eligibilityStatus,
      },
    },
  })

  await logPatientActivity({
    patientId: check.patientId,
    type: 'insurance',
    title: sourceLabel
      ? `Insurance eligibility verified (${sourceLabel})`
      : 'Insurance eligibility verified',
    description: `${summary.eligibilityStatus} — ${formatUserFacingDateTime(now, {
      timeZone: practiceTimeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`,
    metadata: {
      noteId,
      eligibilityCheckId: check.id,
      eligibilityStatus: summary.eligibilityStatus,
      source: 'clearinghouse_api',
      vendorKey: check.vendorKey,
      noteType: 'billing',
    },
    userId: automationUserId,
  })

  return { status: 'complete', summary }
}

export async function finalizeEligibilityCheck(params: {
  eligibilityCheckId: string
  coverage: AvailityCoverageRecord
  triggerVoiceFallback?: (checkId: string, reason: string) => Promise<void>
  appointmentType?: string
}): Promise<{
  status: 'complete' | 'failed' | 'fallback_voice'
  summary?: ParsedEligibilitySummary
}> {
  const summary = parseEligibilityResponse(params.coverage)
  const statusCode = String(params.coverage.statusCode ?? '')
  const isTerminalError =
    statusCode === '19' ||
    ['7', '13', '14', '15'].includes(statusCode) ||
    summary.eligibilityStatus === 'error'

  return finalizeParsedEligibilityCheck({
    eligibilityCheckId: params.eligibilityCheckId,
    summary,
    rawResponse: params.coverage as Record<string, unknown>,
    externalId: params.coverage.id || null,
    statusCode,
    sourceLabel: 'Availity',
    isTerminalError,
    triggerVoiceFallback: params.triggerVoiceFallback,
    appointmentType: params.appointmentType,
  })
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
