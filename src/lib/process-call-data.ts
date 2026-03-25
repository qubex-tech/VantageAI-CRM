/**
 * Process RetellAI Call Data Extraction
 * 
 * Extracts post-call data and creates/updates patient records
 */

import { prisma } from './db'
import { RetellCall } from './retell-api'
import { createAuditLog } from './audit'
import type { Prisma } from '@prisma/client'
import {
  isCurogramEscalationEnabled,
  normalizePhoneToE164,
  resolveCurogramIntentTopic,
  sendCurogramEscalation,
} from './curogram'

export interface ExtractedCallData {
  call_summary?: string
  call_successful?: boolean | string
  user_age?: string | number
  user_phone_number?: string
  patient_phone_number?: string
  patient_email?: string
  detailed_call_summary?: string
  patient_name?: string
  patient_dob?: string
  patient_type?: string
  selected_time?: string
  selected_date?: string
  preferred_dentist?: string
  call_reason?: string
  insurance_verification?: {
    provider_name?: string
    npi?: string
    tax_id?: string
    member_id?: string
    patient_first_name?: string
    patient_last_name?: string
    patient_dob?: string
    coverage_effective_date?: string
    policy_active?: string | boolean
    specialist_office_visit_benefits?: string
    telehealth_benefits?: string
    referral_required?: string | boolean
    cob_primary_plan?: string
    cob_secondary_plan?: string
    insurance_agent_name?: string
    reference_number?: string
  }
  insurance_verification_missing_fields?: string[]
}

type EscalationConversation = {
  id: string
  metadata: Prisma.JsonValue | null
  callerPhone: string
  retellCallId: string | null
}

async function triggerCurogramAfterRetellProcessing(
  practiceId: string,
  call: RetellCall,
  extractedData: ExtractedCallData,
  conversation: EscalationConversation
): Promise<void> {
  if (!call.call_id) return

  let retellIntegration: { curogramEscalationEnabled: boolean; curogramEscalationUrl: string | null } | null = null
  try {
    retellIntegration = await prisma.retellIntegration.findUnique({
      where: { practiceId },
      select: {
        curogramEscalationEnabled: true,
        curogramEscalationUrl: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const missingCurogramColumns =
      message.includes('retell_integrations.curogramEscalationEnabled') ||
      message.includes('retell_integrations.curogramEscalationUrl')
    if (!missingCurogramColumns) throw error
    console.warn('[Curogram Escalation] Migration not yet applied; skipping post-call escalation', {
      practiceId,
      callId: call.call_id,
    })
    return
  }

  const enabled = isCurogramEscalationEnabled({
    enabled: Boolean(retellIntegration?.curogramEscalationEnabled),
    endpointUrl: retellIntegration?.curogramEscalationUrl,
  })
  if (!enabled) return

  const metadata =
    conversation.metadata && typeof conversation.metadata === 'object'
      ? (conversation.metadata as Record<string, unknown>)
      : {}

  // Enforce one escalation attempt per call after full Retell processing.
  if (metadata.curogramEscalationAttemptedAt || metadata.curogramEscalationSentAt) return

  const requestId = `retell-curogram-post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const callerNumber = normalizePhoneToE164(
    extractedData.patient_phone_number || extractedData.user_phone_number
  )

  if (!callerNumber) {
    await prisma.voiceConversation.update({
      where: { id: conversation.id },
      data: {
        metadata: {
          ...metadata,
          curogramEscalationAttemptedAt: new Date().toISOString(),
          curogramEscalationError: 'Missing valid callerNumber for Curogram payload',
          curogramEscalationRequestId: requestId,
          curogramEscalationEventType: 'post_call_processing',
        } as Prisma.InputJsonObject,
      },
    })
    return
  }

  const intentTopic = resolveCurogramIntentTopic({
    callReason: extractedData.call_reason,
    callSummary: extractedData.call_summary,
    defaultIntent: process.env.CUROGRAM_AI_ESCALATION_DEFAULT_INTENT || 'AI call escalation',
  })

  console.log('[Curogram Escalation] Sending after Retell processing', {
    requestId,
    practiceId,
    callId: call.call_id,
    callerNumber,
    hasIntentTopic: Boolean(intentTopic),
  })

  const escalationResult = await sendCurogramEscalation(
    {
      callerNumber,
      intentTopic,
      patientData: extractedData as Record<string, unknown>,
    },
    {
      endpointUrl: retellIntegration?.curogramEscalationUrl,
      requestId,
      callId: call.call_id,
    }
  )

  console.log('[Curogram Escalation] Post-call result', {
    requestId,
    practiceId,
    callId: call.call_id,
    ok: escalationResult.ok,
    status: escalationResult.status,
    responsePreview: escalationResult.body.slice(0, 200),
  })

  await prisma.voiceConversation.update({
    where: { id: conversation.id },
    data: {
      metadata: {
        ...metadata,
        curogramEscalationAttemptedAt: new Date().toISOString(),
        curogramEscalationSentAt: escalationResult.ok ? new Date().toISOString() : null,
        curogramEscalationStatus: escalationResult.status,
        curogramEscalationResponse: escalationResult.body.slice(0, 500),
        curogramEscalationCallerNumber: callerNumber,
        curogramEscalationIntentTopic: intentTopic || null,
        curogramEscalationRequestId: requestId,
        curogramEscalationEventType: 'post_call_processing',
      } as Prisma.InputJsonObject,
    },
  })
}

function firstNonEmptyString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text.length > 0 ? text : undefined
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') return value
  }
  return undefined
}

function getCustomValue(customData: Record<string, any>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = customData[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value)
    }
  }
  return undefined
}

function enrichFromCustomAnalysis(
  extracted: ExtractedCallData,
  customData: Record<string, any>
): ExtractedCallData {
  const normalized = normalizeRetellRecord(customData)

  if (!extracted.patient_dob) {
    const dob = getCustomValue(customData, ['Patient DOB', 'patient_dob'])
    extracted.patient_dob = dob || (normalized.patient_dob as string | undefined)
  }
  if (!extracted.patient_phone_number) {
    const phone = getCustomValue(customData, ['Patient Phone Number', 'Callback Number'])
    extracted.patient_phone_number =
      phone ||
      (normalized.patient_phone_number as string | undefined) ||
      (normalized.callback_number as string | undefined) ||
      (normalized.caller_number as string | undefined) ||
      (normalized.caller_phone_number as string | undefined)
  }
  if (!extracted.user_phone_number) {
    const phone = getCustomValue(customData, ['Callback Number', 'Caller Phone Number'])
    extracted.user_phone_number =
      phone ||
      (normalized.callback_number as string | undefined) ||
      (normalized.caller_phone_number as string | undefined)
  }
  if (!extracted.patient_email) {
    const email = getCustomValue(customData, ['Patient Email', 'Caller Email'])
    extracted.patient_email =
      email ||
      (normalized.patient_email as string | undefined) ||
      (normalized.caller_email as string | undefined)
  }
  if (!extracted.call_reason) {
    const reason = getCustomValue(customData, ['Call Reason'])
    extracted.call_reason = reason || (normalized.call_reason as string | undefined)
  }
  if (!extracted.patient_type) {
    const type = getCustomValue(customData, ['Patient Type'])
    extracted.patient_type = type || (normalized.patient_type as string | undefined)
  }
  if (!extracted.patient_name) {
    const first = getCustomValue(customData, ['Patient First Name'])
    const last = getCustomValue(customData, ['Patient Last Name'])
    const normalizedFirst = normalized.patient_first_name as string | undefined
    const normalizedLast = normalized.patient_last_name as string | undefined
    const resolvedFirst = first || normalizedFirst
    const resolvedLast = last || normalizedLast
    if (resolvedFirst || resolvedLast) {
      extracted.patient_name = `${resolvedFirst || ''} ${resolvedLast || ''}`.trim()
    }
  }
  if (!extracted.patient_name) {
    const callerName = getCustomValue(customData, ['Caller Name'])
    extracted.patient_name =
      callerName || (normalized.caller_name as string | undefined) || extracted.patient_name
  }
  return extracted
}

function normalizeRetellKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeRetellRecord(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    const normalized = normalizeRetellKey(key)
    if (!normalized) continue
    output[normalized] = value
  }
  return output
}

/**
 * Extract post-call data from RetellAI call response
 */
export function extractCallData(call: RetellCall): ExtractedCallData {
  const extracted: ExtractedCallData = {}

  // Extract from call_analysis
  if (call.call_analysis) {
    if (call.call_analysis.call_summary) {
      extracted.call_summary = call.call_analysis.call_summary
    }
    if (call.call_analysis.call_successful !== undefined) {
      extracted.call_successful = call.call_analysis.call_successful
    }

    // Check for custom_analysis_data which often contains extracted fields
    if (call.call_analysis.custom_analysis_data) {
      const customData = call.call_analysis.custom_analysis_data as Record<string, any>
      const normalizedCustomData = normalizeRetellRecord(customData)
      
      console.log('[extractCallData] Found custom_analysis_data:', customData)

      // Always enrich from custom analysis first.
      enrichFromCustomAnalysis(extracted, customData)
      
      // Map common field names - check both exact match and common variations
      if (customData.user_age !== undefined) extracted.user_age = customData.user_age
      if (customData.user_phone_number) extracted.user_phone_number = customData.user_phone_number
      if (customData.patient_phone_number) extracted.patient_phone_number = customData.patient_phone_number
      if (customData.detailed_call_summary) extracted.detailed_call_summary = customData.detailed_call_summary
      if (customData.patient_name) extracted.patient_name = customData.patient_name
      if (customData.patient_dob) extracted.patient_dob = customData.patient_dob
      if (customData.patient_type) extracted.patient_type = customData.patient_type
      if (customData.selected_time) extracted.selected_time = customData.selected_time
      if (customData.selected_date) extracted.selected_date = customData.selected_date
      if (customData.preferred_dentist) extracted.preferred_dentist = customData.preferred_dentist
      if (customData.call_reason) extracted.call_reason = customData.call_reason
      if (!extracted.patient_type && customData.patientType) extracted.patient_type = customData.patientType
      if (!extracted.patient_type && customData.patient_status) extracted.patient_type = customData.patient_status
      if (!extracted.patient_dob && customData.dob) extracted.patient_dob = customData.dob
      
      // Also check for common variations
      if (!extracted.patient_name && customData.name) extracted.patient_name = customData.name
      if (!extracted.user_phone_number && customData.phone) extracted.user_phone_number = customData.phone
      if (!extracted.user_phone_number && customData.phone_number) extracted.user_phone_number = customData.phone_number
      if (!extracted.patient_phone_number && customData.patient_phone_number) {
        extracted.patient_phone_number = customData.patient_phone_number
      }
      if (!extracted.patient_dob) {
        const dob = getCustomValue(customData, ['Patient DOB', 'patient_dob'])
        if (dob) extracted.patient_dob = dob
      }
      if (!extracted.patient_phone_number) {
        const phone = getCustomValue(customData, ['Patient Phone Number', 'Callback Number'])
        if (phone) extracted.patient_phone_number = phone
      }
      if (!extracted.user_phone_number) {
        const phone = getCustomValue(customData, ['Callback Number', 'Caller Phone Number'])
        if (phone) extracted.user_phone_number = phone
      }
      if (!extracted.call_reason) {
        const reason = getCustomValue(customData, ['Call Reason'])
        if (reason) extracted.call_reason = reason
      }
      if (!extracted.patient_type) {
        const type = getCustomValue(customData, ['Patient Type'])
        if (type) extracted.patient_type = type
      }
      if (!extracted.patient_name) {
        const first = getCustomValue(customData, ['Patient First Name'])
        const last = getCustomValue(customData, ['Patient Last Name'])
        if (first || last) {
          extracted.patient_name = `${first || ''} ${last || ''}`.trim()
        }
      }
      if (!extracted.patient_name) {
        const callerName = getCustomValue(customData, ['Caller Name'])
        if (callerName) extracted.patient_name = callerName
      }

      // Normalize Retell keys like "Patient First Name" or "Call Reason"
      if (!extracted.patient_type && normalizedCustomData.patient_type) {
        extracted.patient_type = normalizedCustomData.patient_type as string
      }
      if (!extracted.patient_dob && normalizedCustomData.patient_dob) {
        extracted.patient_dob = normalizedCustomData.patient_dob as string
      }
      if (!extracted.call_reason && normalizedCustomData.call_reason) {
        extracted.call_reason = normalizedCustomData.call_reason as string
      }
      if (!extracted.patient_phone_number && normalizedCustomData.patient_phone_number) {
        extracted.patient_phone_number = normalizedCustomData.patient_phone_number as string
      }
      if (!extracted.patient_phone_number && normalizedCustomData.callback_number) {
        extracted.patient_phone_number = normalizedCustomData.callback_number as string
      }
      if (!extracted.patient_phone_number && normalizedCustomData.caller_number) {
        extracted.patient_phone_number = normalizedCustomData.caller_number as string
      }
      if (!extracted.user_phone_number) {
        extracted.user_phone_number =
          (normalizedCustomData.user_phone_number as string) ||
          (normalizedCustomData.phone_number as string) ||
          (normalizedCustomData.callback_number as string) ||
          (normalizedCustomData.caller_number as string) ||
          (normalizedCustomData.caller_phone_number as string)
      }
      if (!extracted.patient_name) {
        const first = normalizedCustomData.patient_first_name as string | undefined
        const last = normalizedCustomData.patient_last_name as string | undefined
        if (first || last) {
          extracted.patient_name = `${first || ''} ${last || ''}`.trim()
        }
      }
    }
    
    // Also check call_analysis root level for extracted fields (some APIs return them here)
    const analysisData = call.call_analysis as Record<string, any>
    const extractedFields = ['user_age', 'user_phone_number', 'detailed_call_summary', 'patient_name',
                             'patient_dob', 'patient_type', 'selected_time', 'selected_date',
                             'preferred_dentist', 'call_reason', 'name', 'phone', 'phone_number']
    
    for (const field of extractedFields) {
      if (analysisData[field] !== undefined && analysisData[field] !== null && analysisData[field] !== '') {
        if (field === 'name' && !extracted.patient_name) extracted.patient_name = analysisData[field]
        else if (field === 'phone' && !extracted.user_phone_number) extracted.user_phone_number = analysisData[field]
        else if (field === 'phone_number' && !extracted.user_phone_number) extracted.user_phone_number = analysisData[field]
        else if (!extracted[field as keyof ExtractedCallData]) {
          (extracted as any)[field] = analysisData[field]
        }
      }
    }
  }

  // Check metadata field as fallback
  if (call.metadata) {
    const metadata = call.metadata as Record<string, any>
    const normalizedMetadata = normalizeRetellRecord(metadata)
    
    console.log('[extractCallData] Found metadata:', metadata)
    
    if (!extracted.user_age && metadata.user_age !== undefined) extracted.user_age = metadata.user_age
    if (!extracted.user_phone_number && metadata.user_phone_number) extracted.user_phone_number = metadata.user_phone_number
    if (!extracted.patient_phone_number && metadata.patient_phone_number) {
      extracted.patient_phone_number = metadata.patient_phone_number
    }
    if (!extracted.detailed_call_summary && metadata.detailed_call_summary) extracted.detailed_call_summary = metadata.detailed_call_summary
    if (!extracted.patient_name && metadata.patient_name) extracted.patient_name = metadata.patient_name
    if (!extracted.selected_time && metadata.selected_time) extracted.selected_time = metadata.selected_time
    if (!extracted.selected_date && metadata.selected_date) extracted.selected_date = metadata.selected_date
    if (!extracted.preferred_dentist && metadata.preferred_dentist) extracted.preferred_dentist = metadata.preferred_dentist
    if (!extracted.call_reason && metadata.call_reason) extracted.call_reason = metadata.call_reason
    if (!extracted.patient_dob && metadata.patient_dob) extracted.patient_dob = metadata.patient_dob
    if (!extracted.patient_type && metadata.patient_type) extracted.patient_type = metadata.patient_type
    if (!extracted.patient_type && metadata.patientType) extracted.patient_type = metadata.patientType
    
    // Also check for common variations in metadata
    if (!extracted.patient_name && metadata.name) extracted.patient_name = metadata.name
    if (!extracted.user_phone_number && metadata.phone) extracted.user_phone_number = metadata.phone
    if (!extracted.user_phone_number && metadata.phone_number) extracted.user_phone_number = metadata.phone_number
    if (!extracted.patient_phone_number && metadata.patient_phone_number) {
      extracted.patient_phone_number = metadata.patient_phone_number
    }

    if (!extracted.patient_type && normalizedMetadata.patient_type) {
      extracted.patient_type = normalizedMetadata.patient_type as string
    }
    if (!extracted.patient_phone_number && normalizedMetadata.patient_phone_number) {
      extracted.patient_phone_number = normalizedMetadata.patient_phone_number as string
    }
    if (!extracted.patient_dob && normalizedMetadata.patient_dob) {
      extracted.patient_dob = normalizedMetadata.patient_dob as string
    }
    if (!extracted.call_reason && normalizedMetadata.call_reason) {
      extracted.call_reason = normalizedMetadata.call_reason as string
    }
    if (!extracted.user_phone_number) {
      extracted.user_phone_number =
        (normalizedMetadata.user_phone_number as string) ||
        (normalizedMetadata.phone_number as string) ||
        (normalizedMetadata.callback_number as string) ||
        (normalizedMetadata.caller_number as string) ||
        (normalizedMetadata.caller_phone_number as string)
    }
    if (!extracted.patient_name) {
      const first = normalizedMetadata.patient_first_name as string | undefined
      const last = normalizedMetadata.patient_last_name as string | undefined
      if (first || last) {
        extracted.patient_name = `${first || ''} ${last || ''}`.trim()
      }
    }
  }

  const collectedDynamic = (call as any).collected_dynamic_variables as Record<string, unknown> | undefined
  if (collectedDynamic) {
    const normalizedCollected = normalizeRetellRecord(collectedDynamic)
    if (!extracted.patient_type && normalizedCollected.patient_type) {
      extracted.patient_type = normalizedCollected.patient_type as string
    }
    if (!extracted.patient_dob && normalizedCollected.patient_dob) {
      extracted.patient_dob = normalizedCollected.patient_dob as string
    }
    if (!extracted.call_reason && normalizedCollected.call_reason) {
      extracted.call_reason = normalizedCollected.call_reason as string
    }
    if (!extracted.patient_phone_number && normalizedCollected.patient_phone_number) {
      extracted.patient_phone_number = normalizedCollected.patient_phone_number as string
    }
    if (!extracted.user_phone_number) {
      extracted.user_phone_number =
        (normalizedCollected.user_phone_number as string) ||
        (normalizedCollected.phone_number as string) ||
        (normalizedCollected.callback_number as string) ||
        (normalizedCollected.caller_number as string) ||
        (normalizedCollected.caller_phone_number as string)
    }
    if (!extracted.patient_name) {
      const first = normalizedCollected.patient_first_name as string | undefined
      const last = normalizedCollected.patient_last_name as string | undefined
      if (first || last) {
        extracted.patient_name = `${first || ''} ${last || ''}`.trim()
      }
    }
  }
  
  // Also check root level of call object (some APIs return extracted data here)
  const callData = call as Record<string, any>
  const rootExtractedFields = ['user_age', 'user_phone_number', 'detailed_call_summary', 'patient_name',
                               'selected_time', 'selected_date', 'preferred_dentist', 'call_reason',
                               'name', 'phone', 'phone_number']
  
  for (const field of rootExtractedFields) {
    if (callData[field] !== undefined && callData[field] !== null && callData[field] !== '' && 
        !extracted[field as keyof ExtractedCallData]) {
      if (field === 'name' && !extracted.patient_name) extracted.patient_name = callData[field]
      else if (field === 'phone' && !extracted.user_phone_number) extracted.user_phone_number = callData[field]
      else if (field === 'phone_number' && !extracted.user_phone_number) extracted.user_phone_number = callData[field]
      else {
        (extracted as any)[field] = callData[field]
      }
    }
  }

  const customData = (call.call_analysis?.custom_analysis_data || {}) as Record<string, unknown>
  const metadata = (call.metadata || {}) as Record<string, unknown>
  const root = call as unknown as Record<string, unknown>
  const analysisRoot = (call.call_analysis || {}) as Record<string, unknown>

  const insuranceVerification = {
    provider_name: firstNonEmptyString(
      firstDefined(
        customData.provider_name,
        customData.practice_name,
        customData.clinic_name,
        metadata.provider_name,
        metadata.practice_name,
        root.provider_name
      )
    ),
    npi: firstNonEmptyString(
      firstDefined(customData.npi, customData.provider_npi, metadata.npi, analysisRoot.npi, root.npi)
    ),
    tax_id: firstNonEmptyString(
      firstDefined(customData.tax_id, customData.taxid, customData.tin, metadata.tax_id, analysisRoot.tax_id, root.tax_id)
    ),
    member_id: firstNonEmptyString(
      firstDefined(customData.member_id, customData.insurance_id, metadata.member_id, analysisRoot.member_id, root.member_id)
    ),
    patient_first_name: firstNonEmptyString(
      firstDefined(customData.patient_first_name, customData.first_name, metadata.patient_first_name, analysisRoot.patient_first_name)
    ),
    patient_last_name: firstNonEmptyString(
      firstDefined(customData.patient_last_name, customData.last_name, metadata.patient_last_name, analysisRoot.patient_last_name)
    ),
    patient_dob: firstNonEmptyString(
      firstDefined(customData.patient_dob, customData.dob, metadata.patient_dob, analysisRoot.patient_dob, root.patient_dob)
    ),
    coverage_effective_date: firstNonEmptyString(
      firstDefined(customData.coverage_effective_date, customData.effective_date, metadata.coverage_effective_date, analysisRoot.coverage_effective_date)
    ),
    policy_active: firstDefined(
      customData.policy_active,
      customData.is_policy_active,
      metadata.policy_active,
      analysisRoot.policy_active
    ) as string | boolean | undefined,
    specialist_office_visit_benefits: firstNonEmptyString(
      firstDefined(customData.specialist_office_visit_benefits, customData.specialist_benefits, metadata.specialist_office_visit_benefits)
    ),
    telehealth_benefits: firstNonEmptyString(
      firstDefined(customData.telehealth_benefits, customData.televisit_benefits, metadata.telehealth_benefits)
    ),
    referral_required: firstDefined(
      customData.referral_required,
      customData.specialist_referral_required,
      metadata.referral_required,
      analysisRoot.referral_required
    ) as string | boolean | undefined,
    cob_primary_plan: firstNonEmptyString(
      firstDefined(customData.cob_primary_plan, customData.primary_plan, metadata.cob_primary_plan)
    ),
    cob_secondary_plan: firstNonEmptyString(
      firstDefined(customData.cob_secondary_plan, customData.secondary_plan, metadata.cob_secondary_plan)
    ),
    insurance_agent_name: firstNonEmptyString(
      firstDefined(customData.insurance_agent_name, customData.representative_name, metadata.insurance_agent_name)
    ),
    reference_number: firstNonEmptyString(
      firstDefined(customData.reference_number, customData.reference_no, metadata.reference_number, analysisRoot.reference_number)
    ),
  }

  const requiredInsuranceFields = [
    'provider_name',
    'npi',
    'tax_id',
    'member_id',
    'patient_first_name',
    'patient_last_name',
    'patient_dob',
    'coverage_effective_date',
    'policy_active',
    'specialist_office_visit_benefits',
    'telehealth_benefits',
    'referral_required',
    'insurance_agent_name',
    'reference_number',
  ] as const
  const missingInsuranceFields = requiredInsuranceFields.filter((field) => {
    const value = insuranceVerification[field]
    return value === null || value === undefined || String(value).trim() === ''
  })

  if (
    Object.values(insuranceVerification).some((value) => value !== null && value !== undefined && String(value).trim() !== '')
  ) {
    extracted.insurance_verification = insuranceVerification
    extracted.insurance_verification_missing_fields = missingInsuranceFields
  }
  if (!extracted.patient_name && insuranceVerification.patient_first_name && insuranceVerification.patient_last_name) {
    extracted.patient_name = `${insuranceVerification.patient_first_name} ${insuranceVerification.patient_last_name}`.trim()
  }

  console.log('[extractCallData] Final extracted data:', extracted)
  console.log('[extractCallData] Full call object keys:', Object.keys(call))
  if (call.call_analysis) {
    console.log('[extractCallData] call_analysis keys:', Object.keys(call.call_analysis))
  }

  return extracted
}

/**
 * Create or update patient from extracted call data
 */
export async function processCallDataForPatient(
  practiceId: string,
  callData: ExtractedCallData,
  userId: string | null,
  callId?: string
): Promise<{ patientId: string | null; isNew: boolean }> {
  // Need phone number or patient name to identify/create patient.
  // Never derive patient identity from summary text.
  const phoneNumber = callData.patient_phone_number || callData.user_phone_number
  let patientName = callData.patient_name
  if (patientName && /^the caller\b/i.test(patientName.trim())) {
    patientName = undefined
  }

  // Log extracted data for debugging
  console.log('[processCallDataForPatient] Extracted call data:', {
    patient_name: patientName,
    user_phone_number: phoneNumber,
    user_age: callData.user_age,
    callId,
  })

  if (!phoneNumber && !patientName) {
    console.warn('[processCallDataForPatient] No phone number or patient name in extracted call data, skipping patient creation.', {
      callId,
      extractedKeys: Object.keys(callData),
      extractedData: callData,
    })
    return { patientId: null, isNew: false }
  }

  // Normalize phone number - ensure it's a string before calling replace
  const normalizedPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null

  // Try to find existing patient by phone number
  let patient = null
  if (normalizedPhone) {
    patient = await prisma.patient.findFirst({
      where: {
        practiceId,
        phone: normalizedPhone,
        deletedAt: null,
      },
    })

    // If no exact match, try matching with normalized versions
    if (!patient) {
      const allPatients = await prisma.patient.findMany({
        where: {
          practiceId,
          deletedAt: null,
        },
        select: {
          id: true,
          phone: true,
        },
      })

      const matchedPatient = allPatients.find(p => p.phone ? String(p.phone).replace(/\D/g, '') === normalizedPhone : false)
      if (matchedPatient) {
        patient = await prisma.patient.findUnique({
          where: { id: matchedPatient.id },
        })
      }
    }
  }

  // Also try to find by name if phone match failed
  if (!patient && patientName) {
    patient = await prisma.patient.findFirst({
      where: {
        practiceId,
        name: {
          contains: patientName,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    })
  }

  let isNew = false
  const updateData: any = {}

  // Prepare update/create data
  if (patientName && patientName !== patient?.name) {
    updateData.name = patientName
  }

  if (normalizedPhone && normalizedPhone !== patient?.phone) {
    updateData.phone = normalizedPhone
  }

  // Parse age if provided (convert to date of birth estimate)
  if (callData.user_age) {
    const age = typeof callData.user_age === 'string' ? parseInt(callData.user_age) : callData.user_age
    if (!isNaN(age) && age > 0 && age < 150) {
      // Estimate date of birth from age (use Jan 1 of estimated year)
      const currentYear = new Date().getFullYear()
      const estimatedBirthYear = currentYear - age
      updateData.dateOfBirth = new Date(estimatedBirthYear, 0, 1)
    }
  }

  if (callData.patient_dob && !updateData.dateOfBirth) {
    const match = String(callData.patient_dob).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (match) {
      const month = Number(match[1]) - 1
      const day = Number(match[2])
      const year = Number(match[3])
      if (year > 1900 && month >= 0 && month <= 11 && day > 0 && day <= 31) {
        updateData.dateOfBirth = new Date(Date.UTC(year, month, day))
      }
    }
  }

  // Store additional extracted data in notes
  const notesParts: string[] = []
  if (callData.call_reason) notesParts.push(`Call reason: ${callData.call_reason}`)
  if (callData.preferred_dentist) notesParts.push(`Preferred dentist: ${callData.preferred_dentist}`)
  if (callData.detailed_call_summary) notesParts.push(`Call details: ${callData.detailed_call_summary}`)
  
  if (notesParts.length > 0) {
    const newNotes = notesParts.join('\n')
    updateData.notes = patient?.notes 
      ? `${patient.notes}\n\n[From call ${callId || 'unknown'}]:\n${newNotes}`
      : `[From call ${callId || 'unknown'}]:\n${newNotes}`
  }

  if (patient) {
    // Update existing patient
    patient = await prisma.patient.update({
      where: { id: patient.id },
      data: updateData,
    })

    // Create audit log (skip when userId is null - system-initiated actions)
    if (userId) {
      await createAuditLog({
        practiceId,
        userId,
        action: 'update',
        resourceType: 'patient',
        resourceId: patient.id,
        changes: {
          after: {
            source: 'retell_call',
            callId,
            updatedFields: Object.keys(updateData),
          },
        },
      })
    }

    return { patientId: patient.id, isNew: false }
  } else {
    // Create new patient
    if (!patientName) {
      console.warn('Cannot create patient without name')
      return { patientId: null, isNew: false }
    }

    // Phone is required, use a placeholder if not available
    const phoneForCreation = normalizedPhone || '000-000-0000'

    const newPatient = await prisma.patient.create({
      data: {
        practiceId,
        name: patientName,
        phone: phoneForCreation,
        dateOfBirth: updateData.dateOfBirth || new Date('1900-01-01'),
        preferredContactMethod: 'phone',
        notes: updateData.notes || undefined,
      },
    })

    // Create audit log (skip when userId is null - system-initiated actions)
    if (userId) {
      await createAuditLog({
        practiceId,
        userId,
        action: 'create',
        resourceType: 'patient',
        resourceId: newPatient.id,
        changes: {
          after: {
            source: 'retell_call',
            callId,
          },
        },
      })
    }

    return { patientId: newPatient.id, isNew: true }
  }
}

/**
 * Process call data and link to patient
 * @param userId - Optional; when null, audit logging is skipped (e.g. system-initiated via Inngest)
 */
export async function processRetellCallData(
  practiceId: string,
  call: RetellCall,
  userId: string | null
): Promise<{ patientId: string | null; extractedData: ExtractedCallData }> {
  // Extract data from call
  const extractedData = extractCallData(call)
  if (call.call_analysis?.custom_analysis_data) {
    enrichFromCustomAnalysis(extractedData, call.call_analysis.custom_analysis_data as Record<string, any>)
  }
  // Final safety net in case earlier extraction missed custom_analysis_data fields.
  if (call.call_analysis?.custom_analysis_data) {
    const normalizedCustomData = normalizeRetellRecord(
      call.call_analysis.custom_analysis_data as Record<string, unknown>
    )
    if (!extractedData.patient_name) {
      const first = normalizedCustomData.patient_first_name as string | undefined
      const last = normalizedCustomData.patient_last_name as string | undefined
      const caller = normalizedCustomData.caller_name as string | undefined
      if (first || last) {
        extractedData.patient_name = `${first || ''} ${last || ''}`.trim()
      } else if (caller) {
        extractedData.patient_name = caller
      }
    }
    if (!extractedData.patient_phone_number) {
      extractedData.patient_phone_number =
        (normalizedCustomData.patient_phone_number as string) ||
        (normalizedCustomData.callback_number as string) ||
        (normalizedCustomData.caller_number as string) ||
        (normalizedCustomData.caller_phone_number as string)
    }
    if (!extractedData.patient_dob) {
      extractedData.patient_dob = normalizedCustomData.patient_dob as string | undefined
    }
    if (!extractedData.patient_type) {
      extractedData.patient_type = normalizedCustomData.patient_type as string | undefined
    }
    if (!extractedData.call_reason) {
      extractedData.call_reason = normalizedCustomData.call_reason as string | undefined
    }
  }
  // Absolute fallback using exact Retell key casing.
  if (call.call_analysis?.custom_analysis_data) {
    const customData = call.call_analysis.custom_analysis_data as Record<string, any>
    if (!extractedData.patient_name) {
      const first = customData['Patient First Name']
      const last = customData['Patient Last Name']
      const caller = customData['Caller Name']
      if (first || last) {
        extractedData.patient_name = `${first || ''} ${last || ''}`.trim()
      } else if (caller) {
        extractedData.patient_name = String(caller).trim()
      }
    }
    if (!extractedData.patient_phone_number) {
      const phone = customData['Patient Phone Number'] || customData['Callback Number']
      if (phone) extractedData.patient_phone_number = String(phone).trim()
    }
    if (!extractedData.user_phone_number) {
      const phone = customData['Callback Number']
      if (phone) extractedData.user_phone_number = String(phone).trim()
    }
    if (!extractedData.patient_dob && customData['Patient DOB']) {
      extractedData.patient_dob = String(customData['Patient DOB']).trim()
    }
    if (!extractedData.patient_type && customData['Patient Type']) {
      extractedData.patient_type = String(customData['Patient Type']).trim()
    }
    if (!extractedData.call_reason && customData['Call Reason']) {
      extractedData.call_reason = String(customData['Call Reason']).trim()
    }
    if (!extractedData.patient_email) {
      const email = customData['Patient Email'] || customData['Caller Email']
      if (email) extractedData.patient_email = String(email).trim()
    }
  }
  
  // Log extracted data for debugging
  console.log('[processRetellCallData] Extracted data from call:', {
    callId: call.call_id,
    extractedData,
    callAnalysis: call.call_analysis,
    metadata: call.metadata,
  })
  if (extractedData.insurance_verification) {
    console.log('[processRetellCallData] Insurance verification capture summary:', {
      callId: call.call_id,
      capturedFields: Object.keys(extractedData.insurance_verification).filter((k) => {
        const value = (extractedData.insurance_verification as Record<string, unknown>)[k]
        return value !== null && value !== undefined && String(value).trim() !== ''
      }),
      missingFields: extractedData.insurance_verification_missing_fields || [],
    })
  }

  // Create or update patient
  const { patientId, isNew } = await processCallDataForPatient(
    practiceId,
    extractedData,
    userId,
    call.call_id
  )
  
  console.log('[processRetellCallData] Patient processing result:', { patientId, isNew })

  // Update or create voice conversation record
  let conversationForEscalation: EscalationConversation | null = null
  if (call.call_id) {
    const phoneNumber = extractedData.user_phone_number || 'unknown'
    
    // Find existing conversation or create new one
    const existingConversation = await prisma.voiceConversation.findFirst({
      where: {
        practiceId,
        retellCallId: call.call_id,
      },
    })

    if (existingConversation) {
      const existingMetadata =
        existingConversation.metadata && typeof existingConversation.metadata === 'object'
          ? (existingConversation.metadata as Record<string, unknown>)
          : {}

      conversationForEscalation = await prisma.voiceConversation.update({
        where: { id: existingConversation.id },
        data: {
          patientId: patientId || existingConversation.patientId,
          transcript: call.transcript || existingConversation.transcript,
          extractedIntent: extractedData.call_reason || existingConversation.extractedIntent,
          outcome: extractedData.call_successful ? 'appointment_booked' : existingConversation.outcome || 'information_only',
          // Preserve existing webhook metadata (e.g. Curogram delivery logs) while adding extracted fields.
          metadata: {
            ...existingMetadata,
            ...(extractedData as Record<string, unknown>),
          } as any,
          endedAt: call.end_timestamp ? new Date(call.end_timestamp) : existingConversation.endedAt,
        },
      })
    } else {
      conversationForEscalation = await prisma.voiceConversation.create({
        data: {
          practiceId,
          patientId: patientId || undefined,
          callerPhone: phoneNumber ? String(phoneNumber).replace(/\D/g, '') : 'unknown',
          retellCallId: call.call_id,
          startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
          endedAt: call.end_timestamp ? new Date(call.end_timestamp) : undefined,
          transcript: call.transcript || undefined,
          extractedIntent: extractedData.call_reason || undefined,
          outcome: extractedData.call_successful ? 'appointment_booked' : 'information_only',
          metadata: extractedData as any,
        },
      })
    }
  }

  if (conversationForEscalation) {
    const markerMetadata =
      conversationForEscalation.metadata && typeof conversationForEscalation.metadata === 'object'
        ? (conversationForEscalation.metadata as Record<string, unknown>)
        : {}

    // Diagnostic marker to confirm this post-call pipeline runs in production.
    conversationForEscalation = await prisma.voiceConversation.update({
      where: { id: conversationForEscalation.id },
      data: {
        metadata: {
          ...markerMetadata,
          curogramPipelineSeenAt: new Date().toISOString(),
          curogramPipelineVersion: 'post_call_v1',
        } as Prisma.InputJsonObject,
      },
    })

    console.log('[Curogram Escalation] Post-call pipeline reached', {
      practiceId,
      callId: call.call_id,
      conversationId: conversationForEscalation.id,
    })

    await triggerCurogramAfterRetellProcessing(practiceId, call, extractedData, conversationForEscalation)
  }

  return { patientId, extractedData }
}
