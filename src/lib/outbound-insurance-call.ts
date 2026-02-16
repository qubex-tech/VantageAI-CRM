import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { invokeTool } from '@/lib/mcp/registry'
import { normalizePhoneForDialing } from '@/lib/phone'
import { callRetellMcpTool, getRetellIntegrationConfig } from '@/lib/retell-api'

export interface InitiateInsuranceOutboundCallInput {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  insurerPhone?: string
  agentId?: string
  source?: 'api' | 'healix'
}

export async function initiateInsuranceOutboundCall(input: InitiateInsuranceOutboundCallInput) {
  const { practiceId, userId, patientId, policyId, insurerPhone, agentId } = input
  const source = input.source || 'api'
  const ctx = {
    requestId: `outbound-call-${Date.now()}`,
    actorId: userId,
    actorType: 'user' as const,
    purpose: 'insurance verification outbound call',
    allowUnmasked: false,
  }

  const invokeVerificationContext = async (opts: { includePolicyId: boolean }) =>
    invokeTool(
      'get_insurance_verification_context',
      {
        patient_id: patientId,
        policy_id: opts.includePolicyId ? policyId : undefined,
        include_address: true,
        include_rx: true,
        strict_minimum_necessary: true,
      },
      ctx
    )

  let contextResult = await invokeVerificationContext({ includePolicyId: true })

  if (contextResult.error) {
    throw new Error(contextResult.error.message || 'Unable to resolve insurance verification context')
  }

  let contextOutput = contextResult.output as Record<string, any>
  const contextDomainError = contextOutput?.error as { code?: string; message?: string } | undefined
  if (contextDomainError && policyId) {
    console.warn('[OutboundCall][RetellDebug] Context resolution failed with policy_id; retrying with patient_id only', {
      patientId,
      policyId,
      code: contextDomainError.code || null,
      message: contextDomainError.message || null,
    })
    contextResult = await invokeVerificationContext({ includePolicyId: false })
    if (contextResult.error) {
      throw new Error(contextResult.error.message || 'Unable to resolve insurance verification context')
    }
    contextOutput = contextResult.output as Record<string, any>
  }

  const unresolvedError = contextOutput?.error as { message?: string } | undefined
  if (unresolvedError) {
    throw new Error(unresolvedError.message || 'Unable to resolve insurance verification context')
  }

  const selectedPolicyId = contextOutput?.resolution?.policy_id || policyId || null
  const selectedPolicy = selectedPolicyId
    ? await prisma.insurancePolicy.findFirst({
        where: { id: selectedPolicyId, practiceId, patientId },
      })
    : null

  const insurerPhoneRaw = insurerPhone || selectedPolicy?.insurerPhoneRaw || null
  const insurerPhoneNormalized =
    normalizePhoneForDialing(insurerPhoneRaw) || selectedPolicy?.insurerPhoneNormalized || null

  console.info('[OutboundCall] Initiation intent', {
    source,
    practiceId,
    patientId,
    selectedPolicyId,
    phoneSource: insurerPhone ? 'provided' : selectedPolicy?.insurerPhoneRaw ? 'policy' : 'missing',
  })

  if (!insurerPhoneRaw || !insurerPhoneNormalized) {
    throw new Error('Missing insurer phone. Ask for insurance company phone and retry.')
  }

  if (selectedPolicy && insurerPhoneRaw !== selectedPolicy.insurerPhoneRaw) {
    await prisma.insurancePolicy.update({
      where: { id: selectedPolicy.id },
      data: {
        insurerPhoneRaw,
        insurerPhoneNormalized,
      },
    })
  }

  const integration = await getRetellIntegrationConfig(practiceId)
  const toolName = integration.outboundToolName || 'create_outbound_call'
  const patientIdentity = { ...(contextOutput?.patient_identity || {}) } as Record<string, any>
  if (!patientIdentity.first_name || !patientIdentity.last_name || !patientIdentity.date_of_birth) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, practiceId, deletedAt: null },
      select: { name: true, firstName: true, lastName: true, dateOfBirth: true },
    })
    if (patient) {
      const fallbackFullName = patient.name?.trim() || ''
      const fallbackFirst = patient.firstName?.trim() || fallbackFullName.split(/\s+/).filter(Boolean)[0] || ''
      const fallbackLast =
        patient.lastName?.trim() ||
        fallbackFullName.split(/\s+/).filter(Boolean).slice(1).join(' ') ||
        ''
      if (!patientIdentity.first_name) patientIdentity.first_name = fallbackFirst
      if (!patientIdentity.last_name) patientIdentity.last_name = fallbackLast
      if (!patientIdentity.date_of_birth) {
        patientIdentity.date_of_birth = patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : ''
      }
    }
  }
  const verificationBundle = contextOutput?.verification_bundle || {}
  const readiness = verificationBundle?.readiness || {}
  const patientFullName = [patientIdentity.first_name, patientIdentity.last_name].filter(Boolean).join(' ').trim()
  const resolvedPatientId = patientIdentity.patient_id || patientId
  const dynamicVariables: Record<string, string> = {
    patient_id: resolvedPatientId || '',
    patient_name: patientFullName || '',
    patient_full_name: patientFullName || '',
    patient_dob: patientIdentity.date_of_birth || '',
    patient_first_name: patientIdentity.first_name || '',
    patient_last_name: patientIdentity.last_name || '',
    first_name: patientIdentity.first_name || '',
    last_name: patientIdentity.last_name || '',
    dob: patientIdentity.date_of_birth || '',
    policy_id: selectedPolicyId || '',
    verification_bundle: JSON.stringify(verificationBundle || {}),
    verification_bundle_patient_first_name: patientIdentity.first_name || '',
    verification_bundle_patient_last_name: patientIdentity.last_name || '',
    verification_bundle_patient_dob: patientIdentity.date_of_birth || '',
    'verification_bundle.patient.first_name': patientIdentity.first_name || '',
    'verification_bundle.patient.last_name': patientIdentity.last_name || '',
    'verification_bundle.patient.dob': patientIdentity.date_of_birth || '',
  }

  const toolArgs: Record<string, unknown> = {
    to_number: insurerPhoneNormalized,
    agent_id: agentId || integration.insuranceVerificationAgentId || integration.agentId || undefined,
    call_purpose: 'insurance_verification',
    // Pass vars under both keys to support different Retell outbound tool adapters.
    retell_llm_dynamic_variables: dynamicVariables,
    dynamic_variables: dynamicVariables,
    context: {
      patient: {
        id: resolvedPatientId || undefined,
        full_name: patientFullName,
        date_of_birth: patientIdentity.date_of_birth,
      },
      policy: verificationBundle?.insurance || null,
      subscriber: verificationBundle?.subscriber || null,
      payer: {
        name: verificationBundle?.insurance?.payer_name_raw,
        bcbs: verificationBundle?.bcbs || null,
        insurer_phone: insurerPhoneRaw,
      },
      readiness: {
        status: readiness?.status || 'unknown',
        missing_fields: readiness?.missing_fields || [],
        warnings: readiness?.warnings || [],
      },
    },
  }

  const outgoingDynamicVars =
    (toolArgs.retell_llm_dynamic_variables as Record<string, unknown> | undefined) ||
    (toolArgs.dynamic_variables as Record<string, unknown> | undefined) ||
    {}
  console.info('[OutboundCall][RetellDebug] Prepared outbound payload', {
    practiceId,
    patientId,
    selectedPolicyId,
    toolName,
    toNumber: insurerPhoneNormalized,
    agentId: (toolArgs.agent_id as string | undefined) || null,
    dynamicVariableKeys: Object.keys(outgoingDynamicVars),
    dynamicVariablePreview: {
      patient_id: outgoingDynamicVars.patient_id ?? null,
      patient_name: outgoingDynamicVars.patient_name ?? null,
      patient_first_name: outgoingDynamicVars.patient_first_name ?? null,
      patient_last_name: outgoingDynamicVars.patient_last_name ?? null,
      patient_dob: outgoingDynamicVars.patient_dob ?? null,
    },
    hasVerificationBundle: typeof outgoingDynamicVars.verification_bundle === 'string' && (outgoingDynamicVars.verification_bundle as string).length > 0,
  })

  const mcpResult = await callRetellMcpTool({
    config: integration,
    toolName,
    args: toolArgs,
  })

  const voiceConversation = await prisma.voiceConversation.create({
    data: {
      practiceId,
      patientId,
      callerPhone: insurerPhoneRaw,
      retellCallId: mcpResult.callId || null,
      startedAt: new Date(),
      outcome: 'outbound_insurance_verification_initiated',
      metadata: {
        source,
        policyId: selectedPolicyId,
        insurerPhoneRaw,
        insurerPhoneNormalized,
        toolName,
        mcpResult: mcpResult.rawResult as any,
      },
    },
  })

  await createAuditLog({
    practiceId,
    userId,
    action: 'create',
    resourceType: 'voice_conversation',
    resourceId: voiceConversation.id,
    changes: {
      after: {
        source,
        patientId,
        policyId: selectedPolicyId,
        insurerPhoneRaw,
        retellCallId: mcpResult.callId || null,
        toolName,
      },
    },
  })

  console.info('[OutboundCall] MCP call completed', {
    source,
    practiceId,
    patientId,
    policyId: selectedPolicyId,
    retellCallId: mcpResult.callId || null,
    conversationId: voiceConversation.id,
  })

  return {
    callId: mcpResult.callId || null,
    conversationId: voiceConversation.id,
    insurerPhone: insurerPhoneRaw,
    insurerPhoneNormalized,
    policyId: selectedPolicyId,
    readiness: readiness || null,
  }
}
