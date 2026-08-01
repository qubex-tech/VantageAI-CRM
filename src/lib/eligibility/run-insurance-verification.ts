import { initiateInsuranceOutboundCall } from '@/lib/outbound-insurance-call'
import { runAvailityRpaEligibility } from '@/lib/browser-agent'
import { linkVoiceFallbackToCheck } from './finalize-check'
import { runEligibilityCheck, type RunEligibilityCheckResult } from './run-eligibility-check'

export interface RunInsuranceVerificationInput {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source?: 'api' | 'healix' | 'ui'
}

export interface RunInsuranceVerificationResult {
  path: 'availity' | 'availity_rpa' | 'availity_rpa_in_progress' | 'voice' | 'availity_in_progress'
  eligibility?: RunEligibilityCheckResult
  voice?: {
    callId: string | null
    conversationId: string
    insurerPhone: string
  }
  message: string
  browserAgentRunId?: string
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
  })

  if (rpa.started && rpa.status === 'complete') {
    return {
      path: 'availity_rpa',
      browserAgentRunId: rpa.browserAgentRunId,
      eligibility: {
        eligibilityCheckId: rpa.eligibilityCheckId || '',
        status: 'complete',
        summary: rpa.summary as Record<string, unknown> | undefined,
      },
      message: `Eligibility verified via Availity portal (${rpa.summary?.eligibilityStatus || 'complete'})`,
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

  // RPA unavailable or failed → voice
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
    message: rpa.started
      ? `Availity portal RPA failed; started voice verification (${rpa.reason || params.reason})`
      : `Started insurer voice verification call (${params.reason})`,
  }
}

export async function runInsuranceVerification(
  input: RunInsuranceVerificationInput
): Promise<RunInsuranceVerificationResult> {
  const source = input.source || 'api'

  try {
    const eligibility = await runEligibilityCheck({
      practiceId: input.practiceId,
      userId: input.userId,
      patientId: input.patientId,
      policyId: input.policyId,
    })

    if (eligibility.status === 'complete') {
      return {
        path: 'availity',
        eligibility,
        message: `Eligibility verified via Availity (${eligibility.summary?.eligibilityStatus || 'complete'})`,
      }
    }

    if (eligibility.status === 'in_progress' || eligibility.status === 'pending') {
      return {
        path: 'availity_in_progress',
        eligibility,
        message: 'Availity eligibility check in progress',
      }
    }

    // API failed or prerequisites missing → RPA → voice
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
