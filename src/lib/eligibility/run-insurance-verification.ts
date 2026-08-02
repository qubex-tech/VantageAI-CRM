import { prisma } from '@/lib/db'
import { initiateInsuranceOutboundCall } from '@/lib/outbound-insurance-call'
import { runAvailityRpaEligibility } from '@/lib/browser-agent'
import type { ParsedEligibilitySummary } from '@/lib/availity'
import { formatEligibilityNoteContent } from '@/lib/availity'
import { linkVoiceFallbackToCheck } from './finalize-check'
import { runEligibilityCheck, type RunEligibilityCheckResult } from './run-eligibility-check'
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
    | 'availity'
    | 'availity_rpa'
    | 'availity_rpa_in_progress'
    | 'voice'
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
}): Promise<RunInsuranceVerificationResult> {
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

  const voice = await initiateInsuranceOutboundCall({
    practiceId: params.practiceId,
    userId: params.userId,
    patientId: params.patientId,
    policyId: params.policyId,
    insurerPhone: params.insurerPhone,
    agentId: params.agentId,
    source: params.source === 'healix' ? 'healix' : 'api',
  })

  if (rpa.eligibilityCheckId) {
    await linkVoiceFallbackToCheck({
      checkId: rpa.eligibilityCheckId,
      callId: voice.callId,
      conversationId: voice.conversationId,
    })
  }

  return {
    path: 'voice',
    browserAgentRunId: rpa.browserAgentRunId,
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
    message: rpa.started
      ? `Availity portal RPA failed; started voice verification (${rpa.reason || params.reason})`
      : `Started insurer voice verification call (${params.reason})`,
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

  try {
    const eligibility = await runEligibilityCheck({
      practiceId: input.practiceId,
      userId: input.userId,
      patientId: input.patientId,
      policyId: input.policyId,
      appointmentType: input.appointmentType,
    })

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
        path: 'availity',
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
        message: `Eligibility verified via Availity (${summary?.eligibilityStatus || 'complete'})${
          call.required ? ' — SOP requires call confirmation' : ''
        }`,
      }
    }

    if (eligibility.status === 'in_progress' || eligibility.status === 'pending') {
      return {
        path: 'availity_in_progress',
        eligibility,
        message: 'Availity eligibility check in progress',
      }
    }

    return tryRpaThenVoice({
      practiceId: input.practiceId,
      userId: input.userId,
      patientId: input.patientId,
      policyId: input.policyId,
      insurerPhone: input.insurerPhone,
      agentId: input.agentId,
      source,
      eligibilityCheckId: eligibility.eligibilityCheckId || undefined,
      reason: eligibility.errorMessage || 'Availity API eligibility failed',
      appointmentType: input.appointmentType,
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Availity check failed'
    console.warn('[runInsuranceVerification] Availity API threw, trying RPA then voice', {
      practiceId: input.practiceId,
      patientId: input.patientId,
      reason,
    })

    return tryRpaThenVoice({
      practiceId: input.practiceId,
      userId: input.userId,
      patientId: input.patientId,
      policyId: input.policyId,
      insurerPhone: input.insurerPhone,
      agentId: input.agentId,
      source,
      reason,
      appointmentType: input.appointmentType,
    })
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
    console.info('[EligibilityCheck] Triggering voice fallback (after RPA attempt)', {
      checkId,
      reason,
      patientId: params.patientId,
    })

    const rpa = await runAvailityRpaEligibility({
      practiceId: params.practiceId,
      userId: params.userId,
      patientId: params.patientId,
      policyId: params.policyId,
      eligibilityCheckId: checkId,
      appointmentType: params.appointmentType,
    })

    if (rpa.started && (rpa.status === 'complete' || rpa.status === 'in_progress' || rpa.status === 'pending')) {
      console.info('[EligibilityCheck] RPA started instead of immediate voice', {
        checkId,
        status: rpa.status,
        browserAgentRunId: rpa.browserAgentRunId,
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
