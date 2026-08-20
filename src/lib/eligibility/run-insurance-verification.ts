import { prisma } from '@/lib/db'
import { initiateInsuranceOutboundCall } from '@/lib/outbound-insurance-call'
import { runAvailityRpaEligibility } from '@/lib/browser-agent'
import type { ParsedEligibilitySummary } from '@/lib/availity'
import { formatEligibilityNoteContent } from '@/lib/availity'
import { linkVoiceFallbackToCheck } from './finalize-check'
import { runEligibilityCheck, type RunEligibilityCheckResult } from './run-eligibility-check'
import { getEligibilityPathFlags, type EligibilityPathFlags } from './path-flags'
import {
  applyCallRequiredFlag,
  buildMedicareTxNonParPacket,
  formModeForAppointmentType,
  isMedicareOfTexasPayer,
  requiresCallConfirmation,
  shouldRunEligibilityForAppointmentType,
  structuredVoiceFallbackPrompt,
} from './lsr-gates'
import { listUnknownRheumFields, type EligibilityFormMode } from './rheum-packet'

export interface RunInsuranceVerificationInput {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source?: 'api' | 'healix' | 'ui'
  /** Lonestar appointment type code (NP, TVNP, FUV, US, …) */
  appointmentType?: string
  /** Override form mode; defaults from appointment type */
  formMode?: EligibilityFormMode
  /**
   * When true (or when LSR_MEDICARE_TX_NONPAR=1 and payer matches),
   * skip Availity and use Medicare of Texas NON-PAR fixed copays.
   */
  medicareTxNonPar?: boolean
  /** When true, force structured voice fallback after EB if callRequired or unknown fields */
  preferStructuredVoiceFallback?: boolean
}

export interface RunInsuranceVerificationResult {
  path:
    | 'clearinghouse'
    | 'availity'
    | 'availity_rpa'
    | 'availity_rpa_in_progress'
    | 'voice'
    | 'clearinghouse_in_progress'
    | 'availity_in_progress'
    | 'skipped'
    | 'medicare_tx_nonpar'
  eligibility?: RunEligibilityCheckResult
  voice?: {
    callId: string | null
    conversationId: string
    insurerPhone: string
  }
  message: string
  browserAgentRunId?: string
  callRequired?: boolean
  structuredVoicePrompt?: string
}

function attachAppointmentFlags(
  summary: ParsedEligibilitySummary | undefined,
  appointmentType?: string
): ParsedEligibilitySummary | undefined {
  if (!summary) return summary
  if (!summary.rheum) return summary
  return {
    ...summary,
    rheum: applyCallRequiredFlag(summary.rheum, appointmentType),
  }
}

async function triggerVoiceFallback(params: {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source: 'api' | 'healix' | 'ui'
  checkId: string
  reason: string
}) {
  const voice = await initiateInsuranceOutboundCall({
    practiceId: params.practiceId,
    userId: params.userId,
    patientId: params.patientId,
    policyId: params.policyId,
    insurerPhone: params.insurerPhone,
    agentId: params.agentId,
    source: params.source === 'healix' ? 'healix' : 'api',
  })

  await linkVoiceFallbackToCheck({
    checkId: params.checkId,
    callId: voice.callId,
    conversationId: voice.conversationId,
  })

  return voice
}

async function tryRpaThenVoice(params: {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source: 'api' | 'healix' | 'ui'
  eligibilityCheckId?: string
  reason: string
  appointmentType?: string
  flags: EligibilityPathFlags
}): Promise<RunInsuranceVerificationResult> {
  let browserAgentRunId: string | undefined
  let eligibilityCheckId = params.eligibilityCheckId
  let rpaStarted = false
  let rpaReason = params.reason

  if (params.flags.rpaEnabled) {
    console.info('[runInsuranceVerification] Trying Availity portal RPA', {
      practiceId: params.practiceId,
      patientId: params.patientId,
      reason: params.reason,
    })

    const rpa = await runAvailityRpaEligibility({
      practiceId: params.practiceId,
      userId: params.userId,
      patientId: params.patientId,
      policyId: params.policyId,
      eligibilityCheckId: params.eligibilityCheckId,
      appointmentType: params.appointmentType,
    })

    browserAgentRunId = rpa.browserAgentRunId
    eligibilityCheckId = rpa.eligibilityCheckId || eligibilityCheckId
    rpaStarted = rpa.started
    rpaReason = rpa.reason || params.reason

    if (rpa.started && rpa.status === 'complete') {
      const summary = attachAppointmentFlags(rpa.summary, params.appointmentType)
      const call = requiresCallConfirmation(params.appointmentType)
      const unknown = summary?.rheum ? listUnknownRheumFields(summary.rheum) : []
      return {
        path: 'availity_rpa',
        browserAgentRunId: rpa.browserAgentRunId,
        eligibility: {
          eligibilityCheckId: rpa.eligibilityCheckId || '',
          status: 'complete',
          summary: summary as Record<string, unknown> | undefined,
        },
        callRequired: call.required || Boolean(summary?.rheum?.callRequired),
        structuredVoicePrompt:
          call.required || unknown.length
            ? structuredVoiceFallbackPrompt({
                formMode: formModeForAppointmentType(params.appointmentType),
                missingFields: unknown,
                appointmentType: params.appointmentType,
              })
            : undefined,
        message: `Eligibility verified via Availity portal (${summary?.eligibilityStatus || 'complete'})${
          call.required ? ' — SOP requires call confirmation' : ''
        }`,
      }
    }

    if (rpa.started && (rpa.status === 'in_progress' || rpa.status === 'pending')) {
      return {
        path: 'availity_rpa_in_progress',
        browserAgentRunId: rpa.browserAgentRunId,
        eligibility: {
          eligibilityCheckId: rpa.eligibilityCheckId || '',
          status: 'in_progress',
        },
        message: 'Availity portal eligibility check in progress',
      }
    }
  } else {
    console.info('[runInsuranceVerification] Skipping RPA (disabled in settings)', {
      practiceId: params.practiceId,
      patientId: params.patientId,
    })
  }

  if (!params.flags.voiceEnabled) {
    return {
      path: 'skipped',
      browserAgentRunId,
      eligibility: eligibilityCheckId
        ? { eligibilityCheckId, status: 'failed', errorMessage: rpaReason }
        : undefined,
      message: rpaStarted
        ? `Availity portal RPA failed and call-to-insurance is disabled (${rpaReason})`
        : `No remaining eligibility methods enabled (${rpaReason})`,
    }
  }

  const voice = await initiateInsuranceOutboundCall({
    practiceId: params.practiceId,
    userId: params.userId,
    patientId: params.patientId,
    policyId: params.policyId,
    insurerPhone: params.insurerPhone,
    agentId: params.agentId,
    source: params.source === 'healix' ? 'healix' : 'api',
  })

  if (eligibilityCheckId) {
    await linkVoiceFallbackToCheck({
      checkId: eligibilityCheckId,
      callId: voice.callId,
      conversationId: voice.conversationId,
    })
  }

  return {
    path: 'voice',
    browserAgentRunId,
    voice: {
      callId: voice.callId,
      conversationId: voice.conversationId,
      insurerPhone: voice.insurerPhone,
    },
    callRequired: true,
    structuredVoicePrompt: structuredVoiceFallbackPrompt({
      formMode: formModeForAppointmentType(params.appointmentType),
      missingFields: [],
      appointmentType: params.appointmentType,
    }),
    message: rpaStarted
      ? `Availity portal RPA failed; started voice verification (${rpaReason})`
      : `Started insurer voice verification call (${rpaReason})`,
  }
}

async function runMedicareTxNonParShortCircuit(params: {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  appointmentType?: string
}): Promise<RunInsuranceVerificationResult> {
  const policy = params.policyId
    ? await prisma.insurancePolicy.findFirst({
        where: {
          id: params.policyId,
          practiceId: params.practiceId,
          patientId: params.patientId,
        },
      })
    : await prisma.insurancePolicy.findFirst({
        where: { practiceId: params.practiceId, patientId: params.patientId },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      })

  if (!policy) {
    throw new Error('No insurance policy found for patient')
  }

  const rheum = buildMedicareTxNonParPacket({ appointmentType: params.appointmentType })
  const summary: ParsedEligibilitySummary = {
    eligibilityStatus: 'active',
    planStatus: 'Medicare TX NON-PAR schedule',
    payerName: policy.payerNameRaw,
    planType: 'Medicare',
    benefits: [],
    validationMessages: [],
    rawPlanCount: 0,
    rheum,
  }

  const now = new Date()
  const check = await prisma.eligibilityCheck.create({
    data: {
      practiceId: params.practiceId,
      patientId: params.patientId,
      policyId: policy.id,
      source: 'availity_api',
      status: 'complete',
      parsedSummary: summary as object,
      requestPayload: {
        shortCircuit: 'medicare_tx_nonpar',
        appointmentType: params.appointmentType || null,
      },
      completedAt: now,
    },
  })

  await prisma.insurancePolicy.update({
    where: { id: policy.id },
    data: {
      eligibilityStatus: 'active',
      lastEligibilityCheckedAt: now,
    },
  })

  const noteContent = formatEligibilityNoteContent({
    summary,
    payerNameRaw: policy.payerNameRaw,
    checkedAt: now,
  }).replace('Insurance Eligibility (Availity)', 'Insurance Eligibility (Medicare TX NON-PAR)')

  await prisma.patientNote.create({
    data: {
      patientId: params.patientId,
      practiceId: params.practiceId,
      userId: params.userId,
      type: 'insurance',
      content: noteContent,
    },
  })

  return {
    path: 'medicare_tx_nonpar',
    eligibility: {
      eligibilityCheckId: check.id,
      status: 'complete',
      summary: summary as unknown as Record<string, unknown>,
    },
    callRequired: Boolean(rheum.callRequired),
    message: `Medicare of Texas NON-PAR schedule applied (specialist copay ${rheum.specialistCopay})`,
  }
}

export async function runInsuranceVerification(
  input: RunInsuranceVerificationInput
): Promise<RunInsuranceVerificationResult> {
  const source = input.source || 'api'

  const gate = shouldRunEligibilityForAppointmentType(input.appointmentType)
  if (!gate.run) {
    return {
      path: 'skipped',
      message: gate.reason,
    }
  }

  const flags = await getEligibilityPathFlags(input.practiceId)
  if (!flags.apiEnabled && !flags.rpaEnabled && !flags.voiceEnabled) {
    return {
      path: 'skipped',
      message:
        'All eligibility verification methods are disabled. Enable API, portal RPA, and/or call to insurance in Settings.',
    }
  }

  // Resolve policy early for Medicare TX short-circuit
  const policy = input.policyId
    ? await prisma.insurancePolicy.findFirst({
        where: {
          id: input.policyId,
          practiceId: input.practiceId,
          patientId: input.patientId,
        },
      })
    : await prisma.insurancePolicy.findFirst({
        where: { practiceId: input.practiceId, patientId: input.patientId },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      })

  const medicareEnv = process.env.LSR_MEDICARE_TX_NONPAR === '1'
  const medicareShortCircuit =
    (input.medicareTxNonPar === true || (medicareEnv && input.medicareTxNonPar !== false)) &&
    isMedicareOfTexasPayer(policy?.payerNameRaw)

  if (medicareShortCircuit) {
    return runMedicareTxNonParShortCircuit({
      practiceId: input.practiceId,
      userId: input.userId,
      patientId: input.patientId,
      policyId: policy?.id,
      appointmentType: input.appointmentType,
    })
  }

  const fallback = (reason: string, eligibilityCheckId?: string) =>
    tryRpaThenVoice({
      practiceId: input.practiceId,
      userId: input.userId,
      patientId: input.patientId,
      policyId: input.policyId,
      insurerPhone: input.insurerPhone,
      agentId: input.agentId,
      source,
      eligibilityCheckId,
      reason,
      appointmentType: input.appointmentType,
      flags,
    })

  if (!flags.apiEnabled) {
    console.info('[runInsuranceVerification] Skipping API (disabled in settings)', {
      practiceId: input.practiceId,
      patientId: input.patientId,
    })
    return fallback('Clearinghouse API disabled in settings')
  }

  try {
    const eligibility = await runEligibilityCheck({
      practiceId: input.practiceId,
      userId: input.userId,
      patientId: input.patientId,
      policyId: input.policyId,
      appointmentType: input.appointmentType,
    })
    const vendorLabel = eligibility.vendorDisplayName || 'clearinghouse'

    if (eligibility.status === 'complete') {
      const summary = attachAppointmentFlags(
        eligibility.summary as ParsedEligibilitySummary | undefined,
        input.appointmentType
      )
      if (summary && eligibility.eligibilityCheckId) {
        await prisma.eligibilityCheck.update({
          where: { id: eligibility.eligibilityCheckId },
          data: { parsedSummary: summary as object },
        })
      }
      const call = requiresCallConfirmation(input.appointmentType)
      const unknown = summary?.rheum ? listUnknownRheumFields(summary.rheum) : []
      return {
        path: 'clearinghouse',
        eligibility: { ...eligibility, summary: summary as Record<string, unknown> | undefined },
        callRequired: call.required || Boolean(summary?.rheum?.callRequired),
        structuredVoicePrompt:
          call.required || unknown.length
            ? structuredVoiceFallbackPrompt({
                formMode: input.formMode || formModeForAppointmentType(input.appointmentType),
                missingFields: unknown,
                appointmentType: input.appointmentType,
              })
            : undefined,
        message: `Eligibility verified via ${vendorLabel} (${summary?.eligibilityStatus || 'complete'})${
          call.required ? ' — SOP requires call confirmation' : ''
        }`,
      }
    }

    if (eligibility.status === 'in_progress' || eligibility.status === 'pending') {
      return {
        path: 'clearinghouse_in_progress',
        eligibility,
        message: `${vendorLabel} eligibility check in progress`,
      }
    }

    return fallback(
      eligibility.errorMessage || `${vendorLabel} eligibility failed`,
      eligibility.eligibilityCheckId || undefined
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Clearinghouse eligibility check failed'
    console.warn('[runInsuranceVerification] Clearinghouse API threw, trying next enabled methods', {
      practiceId: input.practiceId,
      patientId: input.patientId,
      reason,
    })

    return fallback(reason)
  }
}

/** Voice-only fallback (no RPA). Use after portal RPA already failed. */
export async function createDirectVoiceFallbackHandler(params: {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source?: 'api' | 'healix' | 'ui'
}) {
  return async (checkId: string, reason: string) => {
    const flags = await getEligibilityPathFlags(params.practiceId)
    if (!flags.voiceEnabled) {
      console.info('[EligibilityCheck] Skipping voice fallback (disabled in settings)', {
        checkId,
        reason,
        patientId: params.patientId,
      })
      return
    }
    console.info('[EligibilityCheck] Triggering direct voice fallback', {
      checkId,
      reason,
      patientId: params.patientId,
    })
    await triggerVoiceFallback({
      ...params,
      checkId,
      reason,
      source: params.source || 'api',
    })
  }
}

/**
 * Prefer Availity portal RPA before voice when API polling fails/times out.
 * Pass skipRpa=true when RPA already ran (avoids loops).
 */
export async function createVoiceFallbackHandler(params: {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source?: 'api' | 'healix' | 'ui'
  skipRpa?: boolean
  appointmentType?: string
}) {
  if (params.skipRpa) {
    return createDirectVoiceFallbackHandler(params)
  }

  return async (checkId: string, reason: string) => {
    const flags = await getEligibilityPathFlags(params.practiceId)

    console.info('[EligibilityCheck] Triggering cascade fallback after API polling', {
      checkId,
      reason,
      patientId: params.patientId,
      rpaEnabled: flags.rpaEnabled,
      voiceEnabled: flags.voiceEnabled,
    })

    if (flags.rpaEnabled) {
      const rpa = await runAvailityRpaEligibility({
        practiceId: params.practiceId,
        userId: params.userId,
        patientId: params.patientId,
        policyId: params.policyId,
        eligibilityCheckId: checkId,
        appointmentType: params.appointmentType,
      })

      if (
        rpa.started &&
        (rpa.status === 'complete' || rpa.status === 'in_progress' || rpa.status === 'pending')
      ) {
        console.info('[EligibilityCheck] RPA started instead of immediate voice', {
          checkId,
          status: rpa.status,
          browserAgentRunId: rpa.browserAgentRunId,
        })
        return
      }
    }

    if (!flags.voiceEnabled) {
      console.info('[EligibilityCheck] Skipping voice fallback (disabled in settings)', {
        checkId,
        reason,
      })
      return
    }

    await triggerVoiceFallback({
      ...params,
      checkId,
      reason,
      source: params.source || 'api',
    })
  }
}
