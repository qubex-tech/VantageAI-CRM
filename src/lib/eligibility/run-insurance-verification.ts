import { initiateInsuranceOutboundCall } from '@/lib/outbound-insurance-call'
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
  path: 'availity' | 'voice' | 'availity_in_progress'
  eligibility?: RunEligibilityCheckResult
  voice?: {
    callId: string | null
    conversationId: string
    insurerPhone: string
  }
  message: string
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

    if (!eligibility.eligibilityCheckId) {
      const voice = await initiateInsuranceOutboundCall({
        practiceId: input.practiceId,
        userId: input.userId,
        patientId: input.patientId,
        policyId: input.policyId,
        insurerPhone: input.insurerPhone,
        agentId: input.agentId,
        source: source === 'healix' ? 'healix' : 'api',
      })
      return {
        path: 'voice',
        eligibility,
        voice: {
          callId: voice.callId,
          conversationId: voice.conversationId,
          insurerPhone: voice.insurerPhone,
        },
        message: `Availity prerequisites missing; started voice verification (${eligibility.errorMessage})`,
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Availity check failed'
    console.warn('[runInsuranceVerification] Availity failed, falling back to voice', {
      practiceId: input.practiceId,
      patientId: input.patientId,
      reason,
    })
  }

  const voice = await initiateInsuranceOutboundCall({
    practiceId: input.practiceId,
    userId: input.userId,
    patientId: input.patientId,
    policyId: input.policyId,
    insurerPhone: input.insurerPhone,
    agentId: input.agentId,
    source: source === 'healix' ? 'healix' : 'api',
  })

  return {
    path: 'voice',
    voice: {
      callId: voice.callId,
      conversationId: voice.conversationId,
      insurerPhone: voice.insurerPhone,
    },
    message: 'Started insurer voice verification call',
  }
}

export async function createVoiceFallbackHandler(params: {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source?: 'api' | 'healix' | 'ui'
}) {
  return async (checkId: string, reason: string) => {
    console.info('[EligibilityCheck] Triggering voice fallback', {
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
