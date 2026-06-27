import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { invokeTool } from '@/lib/mcp/registry'
import { normalizePhoneForDialing } from '@/lib/phone'
import { callRetellMcpTool, getRetellIntegrationConfig } from '@/lib/retell-api'
import { logRetellInsurancePassed } from '@/lib/mcp/request-log'
import { buildVerificationAgentFields, formatPatientDob } from '@/lib/mcp/verification-fields'

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
    allowUnmasked: true,
    practiceId,
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
      { ...ctx, logRoute: 'outbound-insurance-call', logSource: 'in_process' }
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
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { name: true },
  })
  const practiceName = practice?.name?.trim() || ''
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
        patientIdentity.date_of_birth = patient.dateOfBirth ? formatPatientDob(patient.dateOfBirth) : ''
      }
      if (!patientIdentity.patient_dob) {
        patientIdentity.patient_dob = patientIdentity.date_of_birth
      }
    }
  }
  const verificationBundle = contextOutput?.verification_bundle || {}
  const bundleInsurance = (verificationBundle?.insurance || {}) as Record<string, unknown>
  const readiness = verificationBundle?.readiness || {}
  const agentFields = buildVerificationAgentFields({
    firstName:
      (contextOutput.patient_first_name as string | undefined) ||
      patientIdentity.patient_first_name ||
      patientIdentity.first_name,
    lastName:
      (contextOutput.patient_last_name as string | undefined) ||
      patientIdentity.patient_last_name ||
      patientIdentity.last_name,
    dateOfBirth:
      (contextOutput.patient_dob as string | undefined) ||
      patientIdentity.patient_dob ||
      patientIdentity.date_of_birth,
    memberId:
      (contextOutput.member_id as string | undefined) ||
      String(bundleInsurance.member_id || bundleInsurance.member_id_masked || ''),
    groupNumber:
      (contextOutput.group_number as string | undefined) ||
      String(bundleInsurance.group_number || bundleInsurance.group_number_masked || ''),
  })
  const patientFullName = [agentFields.patient_first_name, agentFields.patient_last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  const resolvedPatientId = patientIdentity.patient_id || patientId
  const planName = String(bundleInsurance.plan_name || '').trim()
  const dynamicVariables: Record<string, string> = {
    ...agentFields,
    practice_name: practiceName,
    provider_name: practiceName,
    patient_id: resolvedPatientId || '',
    patient_name: patientFullName || '',
    patient_full_name: patientFullName || '',
    patient_dob: agentFields.patient_dob,
    patient_first_name: agentFields.patient_first_name,
    patient_last_name: agentFields.patient_last_name,
    first_name: agentFields.patient_first_name,
    last_name: agentFields.patient_last_name,
    dob: agentFields.patient_dob,
    policy_id: selectedPolicyId || '',
    member_id: agentFields.member_id,
    group_number: agentFields.group_number,
    plan_name: planName,
    insurance_member_id: agentFields.member_id,
    insurance_group_number: agentFields.group_number,
    insurance_plan_name: planName,
    verification_bundle: JSON.stringify(verificationBundle || {}),
    verification_bundle_patient_first_name: agentFields.patient_first_name,
    verification_bundle_patient_last_name: agentFields.patient_last_name,
    verification_bundle_patient_dob: agentFields.patient_dob,
    'verification_bundle.patient.first_name': agentFields.patient_first_name,
    'verification_bundle.patient.last_name': agentFields.patient_last_name,
    'verification_bundle.patient.dob': agentFields.patient_dob,
  }

  const toolArgs: Record<string, unknown> = {
    to_number: insurerPhoneNormalized,
    agent_id: agentId || integration.insuranceVerificationAgentId || integration.agentId || undefined,
    call_purpose: 'insurance_verification',
    // Pass vars under both keys to support different Retell outbound tool adapters.
    retell_llm_dynamic_variables: dynamicVariables,
    dynamic_variables: dynamicVariables,
    context: {
      practice: {
        name: practiceName || undefined,
      },
      patient: {
        id: resolvedPatientId || undefined,
        full_name: patientFullName,
        first_name: agentFields.patient_first_name || undefined,
        last_name: agentFields.patient_last_name || undefined,
        date_of_birth: agentFields.patient_dob || undefined,
        patient_first_name: agentFields.patient_first_name || undefined,
        patient_last_name: agentFields.patient_last_name || undefined,
        patient_dob: agentFields.patient_dob || undefined,
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
  logRetellInsurancePassed({
    route: 'outbound-insurance-call',
    patientIdPrefix: resolvedPatientId?.slice(0, 8),
    policyIdPrefix: selectedPolicyId?.slice(0, 8),
    verificationBundle,
    contextPolicy: verificationBundle?.insurance ?? null,
  })

  console.info('[OutboundCall][RetellDebug] Prepared outbound payload', {
    practiceId,
    patientId,
    selectedPolicyId,
    toolName,
    toNumber: insurerPhoneNormalized,
    agentId: (toolArgs.agent_id as string | undefined) || null,
    dynamicVariableKeys: Object.keys(outgoingDynamicVars),
    dynamicVariablePreview: {
      practice_name: outgoingDynamicVars.practice_name ?? null,
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
        retell_call_direction: 'outbound',
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

  logRetellInsurancePassed({
    route: 'outbound-insurance-call-complete',
    retellCallId: mcpResult.callId || null,
    patientIdPrefix: patientId.slice(0, 8),
    policyIdPrefix: selectedPolicyId?.slice(0, 8),
    verificationBundle,
    contextPolicy: verificationBundle?.insurance ?? null,
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
