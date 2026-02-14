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

  const contextResult = await invokeTool(
    'get_insurance_verification_context',
    {
      patient_id: patientId,
      policy_id: policyId,
      include_address: true,
      include_rx: true,
      strict_minimum_necessary: true,
    },
    ctx
  )

  if (contextResult.error) {
    throw new Error(contextResult.error.message || 'Unable to resolve insurance verification context')
  }

  const contextOutput = contextResult.output as Record<string, any>
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
  const patientIdentity = contextOutput?.patient_identity || {}
  const verificationBundle = contextOutput?.verification_bundle || {}
  const readiness = verificationBundle?.readiness || {}
  const patientFullName = [patientIdentity.first_name, patientIdentity.last_name].filter(Boolean).join(' ').trim()
  const resolvedPatientId = patientIdentity.patient_id || patientId

  const toolArgs: Record<string, unknown> = {
    to_number: insurerPhoneNormalized,
    agent_id: agentId || integration.insuranceVerificationAgentId || integration.agentId || undefined,
    call_purpose: 'insurance_verification',
    retell_llm_dynamic_variables: {
      verification_bundle: JSON.stringify(verificationBundle || {}),
      patient_id: resolvedPatientId || '',
      patient_name: patientFullName || '',
      patient_dob: patientIdentity.date_of_birth || '',
      patient_first_name: patientIdentity.first_name || '',
      patient_last_name: patientIdentity.last_name || '',
      'verification_bundle.patient.first_name': patientIdentity.first_name || '',
      'verification_bundle.patient.last_name': patientIdentity.last_name || '',
      'verification_bundle.patient.dob': patientIdentity.date_of_birth || '',
      policy_id: selectedPolicyId || '',
    },
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
