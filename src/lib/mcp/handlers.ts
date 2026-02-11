import * as db from './db'
import { maskLast4 } from './masking'
import { computeReadiness } from './readiness'
import { writeMcpAuditLog, collectFieldPaths } from './audit'
import type {
  GetPatientIdentityInput,
  ListInsurancePoliciesInput,
  GetInsurancePolicyDetailsInput,
  GetVerificationBundleInput,
  SearchPatientByDemographicsInput,
  GetInsuranceVerificationContextInput,
} from './schemas'

export interface RequestContext {
  requestId: string
  actorId: string
  actorType: 'agent' | 'user' | 'system'
  purpose: string
  allowUnmasked: boolean
}

function getPatientNameParts(patient: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}) {
  const first = patient.firstName?.trim()
  const last = patient.lastName?.trim()
  const full = patient.name?.trim()
  let fromName: { first: string; last: string } | null = null
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    if (parts.length >= 1) {
      fromName =
        parts.length === 1
          ? { first: parts[0], last: parts[0] }
          : { first: parts[0], last: parts.slice(1).join(' ') }
    }
  }
  return {
    firstName: first || fromName?.first || '',
    lastName: last || fromName?.last || '',
  }
}

export async function handleGetPatientIdentity(
  input: GetPatientIdentityInput,
  ctx: RequestContext
): Promise<{ output: object; patientId: string | null }> {
  const patient = await db.getPatientById(input.patient_id)
  if (!patient) {
    return { output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } }, patientId: input.patient_id }
  }
  const nameParts = getPatientNameParts(patient)
  const output: Record<string, unknown> = {
    patient_id: patient.id,
    first_name: nameParts.firstName || undefined,
    last_name: nameParts.lastName || undefined,
    date_of_birth: patient.dateOfBirth?.toISOString().slice(0, 10),
    phone: patient.primaryPhone || patient.phone || undefined,
    email: patient.email || undefined,
  }
  if (input.include_address) {
    output.address = {
      line1: patient.addressLine1 || undefined,
      line2: patient.addressLine2 || undefined,
      city: patient.city || undefined,
      state: patient.state || undefined,
      zip: patient.postalCode || undefined,
    }
  }
  await writeMcpAuditLog({
    ...ctx,
    patientId: patient.id,
    policyId: null,
    toolName: 'get_patient_identity',
    fieldsReturned: collectFieldPaths(output),
  })
  return { output, patientId: patient.id }
}

export async function handleListInsurancePolicies(
  input: ListInsurancePoliciesInput,
  ctx: RequestContext
): Promise<{ output: object; patientId: string | null }> {
  const patient = await db.getPatientById(input.patient_id)
  if (!patient) {
    return { output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } }, patientId: input.patient_id }
  }
  const policies = await db.getInsurancePoliciesByPatientId(input.patient_id)
  const readiness = policies.map((p) => computeReadiness(p, patient))
  const policiesOut = policies.map((p, i) => ({
    policy_id: p.id,
    payer_name_raw: p.payerNameRaw,
    is_primary: p.isPrimary,
    plan_type: p.planType ?? undefined,
    member_id_masked: maskLast4(p.memberId),
    completeness: {
      status: readiness[i].status,
      missing_fields: readiness[i].missing_fields,
    },
  }))
  const output = { policies: policiesOut }
  await writeMcpAuditLog({
    ...ctx,
    patientId: patient.id,
    policyId: null,
    toolName: 'list_insurance_policies',
    fieldsReturned: collectFieldPaths(output),
  })
  return { output, patientId: patient.id }
}

export async function handleGetInsurancePolicyDetails(
  input: GetInsurancePolicyDetailsInput,
  ctx: RequestContext
): Promise<{ output: object; patientId: string | null; policyId: string | null }> {
  const policy = await db.getInsurancePolicyById(input.policy_id)
  if (!policy) {
    return {
      output: { error: { code: 'NOT_FOUND', message: 'Policy not found' } },
      patientId: null,
      policyId: input.policy_id,
    }
  }
  const memberIdDisplay = ctx.allowUnmasked ? policy.memberId : maskLast4(policy.memberId)
  const groupNumberDisplay = ctx.allowUnmasked
    ? (policy.groupNumber ?? undefined)
    : (policy.groupNumber ? maskLast4(policy.groupNumber) : undefined)
  const output: Record<string, unknown> = {
    policy_id: policy.id,
    patient_id: policy.patientId,
    payer_name_raw: policy.payerNameRaw,
    plan_name: policy.planName ?? undefined,
    plan_type: policy.planType ?? undefined,
    is_primary: policy.isPrimary,
    member_id_masked: memberIdDisplay,
    group_number_masked: groupNumberDisplay,
    subscriber: {
      subscriber_is_patient: policy.subscriberIsPatient,
      first_name: policy.subscriberFirstName ?? undefined,
      last_name: policy.subscriberLastName ?? undefined,
      dob: policy.subscriberDob?.toISOString().slice(0, 10),
      relationship_to_patient: policy.relationshipToPatient ?? undefined,
    },
    bcbs: {
      alpha_prefix: policy.bcbsAlphaPrefix ?? undefined,
      state_plan: policy.bcbsStatePlan ?? undefined,
    },
  }
  if (input.include_rx) {
    output.rx = {
      rx_bin: policy.rxBin ?? undefined,
      rx_pcn: policy.rxPcn ?? undefined,
      rx_group: policy.rxGroup ?? undefined,
    }
  }
  if (input.include_card_refs) {
    output.card_refs = {
      front_ref: policy.cardFrontRef ?? undefined,
      back_ref: policy.cardBackRef ?? undefined,
    }
  }
  await writeMcpAuditLog({
    ...ctx,
    patientId: policy.patientId,
    policyId: policy.id,
    toolName: 'get_insurance_policy_details',
    fieldsReturned: collectFieldPaths(output),
  })
  return { output, patientId: policy.patientId, policyId: policy.id }
}

export async function handleGetVerificationBundle(
  input: GetVerificationBundleInput,
  ctx: RequestContext
): Promise<{ output: object; patientId: string | null; policyId: string | null }> {
  let policy: Awaited<ReturnType<typeof db.getInsurancePolicyById>> | Awaited<ReturnType<typeof db.getPrimaryPolicyForPatient>>
  let patient: { id: string; name: string | null; firstName: string | null; lastName: string | null; dateOfBirth: Date | null; primaryPhone?: string | null; phone?: string; email?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null } | null

  if (input.policy_id) {
    const row = await db.getInsurancePolicyById(input.policy_id)
    policy = row
    patient = row?.patient ?? null
  } else {
    const row = await db.getPrimaryPolicyForPatient(input.patient_id!)
    policy = row
    patient = row?.patient ?? null
  }

  if (!patient) {
    const p = input.patient_id ? await db.getPatientById(input.patient_id) : null
    if (!p) {
      return {
        output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } },
        patientId: input.patient_id ?? null,
        policyId: null,
      }
    }
    return {
      output: { error: { code: 'NOT_FOUND', message: 'No insurance policy found for patient' } },
      patientId: input.patient_id ?? p.id,
      policyId: null,
    }
  }

  if (!policy) {
    return {
      output: { error: { code: 'NOT_FOUND', message: 'No insurance policy found for patient' } },
      patientId: patient.id,
      policyId: null,
    }
  }

  const memberIdDisplay = ctx.allowUnmasked ? policy.memberId : maskLast4(policy.memberId)
  const groupNumberDisplay = ctx.allowUnmasked
    ? (policy.groupNumber ?? undefined)
    : (policy.groupNumber ? maskLast4(policy.groupNumber) : undefined)
  const nameParts = getPatientNameParts(patient)
  const readiness = computeReadiness(policy, patient)
  const patientPhone = 'primaryPhone' in patient ? patient.primaryPhone : (patient as { phone?: string }).phone
  const output: Record<string, unknown> = {
    patient: {
      first_name: nameParts.firstName || undefined,
      last_name: nameParts.lastName || undefined,
      dob: patient.dateOfBirth?.toISOString().slice(0, 10),
      phone: patientPhone ?? undefined,
    },
    insurance: {
      payer_name_raw: policy.payerNameRaw,
      member_id_masked: memberIdDisplay,
      group_number_masked: groupNumberDisplay,
      plan_name: policy.planName ?? undefined,
      plan_type: policy.planType ?? undefined,
      is_primary: policy.isPrimary,
    },
    subscriber: {
      subscriber_is_patient: policy.subscriberIsPatient,
      first_name: policy.subscriberFirstName ?? undefined,
      last_name: policy.subscriberLastName ?? undefined,
      dob: policy.subscriberDob?.toISOString().slice(0, 10),
      relationship_to_patient: policy.relationshipToPatient ?? undefined,
    },
    bcbs: {
      alpha_prefix: policy.bcbsAlphaPrefix ?? undefined,
      state_plan: policy.bcbsStatePlan ?? undefined,
    },
    readiness: {
      status: readiness.status,
      missing_fields: readiness.missing_fields,
      warnings: readiness.warnings,
    },
  }
  if (input.include_address) {
    (output.patient as Record<string, unknown>).address = {
      line1: patient.addressLine1 ?? undefined,
      city: patient.city ?? undefined,
      state: patient.state ?? undefined,
      zip: patient.postalCode ?? undefined,
    }
  }
  if (input.include_rx) {
    output.rx = {
      rx_bin: policy.rxBin ?? undefined,
      rx_pcn: policy.rxPcn ?? undefined,
      rx_group: policy.rxGroup ?? undefined,
    }
  }
  await writeMcpAuditLog({
    ...ctx,
    patientId: patient.id,
    policyId: policy.id,
    toolName: 'get_verification_bundle',
    fieldsReturned: collectFieldPaths(output),
  })
  return { output, patientId: patient.id, policyId: policy.id }
}

export async function handleGetInsuranceVerificationContext(
  input: GetInsuranceVerificationContextInput,
  ctx: RequestContext
): Promise<{ output: object; patientId: string | null; policyId: string | null }> {
  let patient: Awaited<ReturnType<typeof db.getPatientById>> | null = null
  let selectedPolicy: any | null = null
  let matchedBy: 'patient_id' | 'policy_id' | 'demographics' = 'patient_id'

  if (input.policy_id) {
    selectedPolicy = await db.getInsurancePolicyById(input.policy_id)
    if (!selectedPolicy) {
      return {
        output: { error: { code: 'NOT_FOUND', message: 'Policy not found' } },
        patientId: null,
        policyId: input.policy_id,
      }
    }
    patient = selectedPolicy.patient ?? null
    matchedBy = 'policy_id'
  } else if (input.patient_id) {
    patient = await db.getPatientById(input.patient_id)
    if (!patient) {
      return {
        output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } },
        patientId: input.patient_id,
        policyId: null,
      }
    }
    matchedBy = 'patient_id'
  } else {
    const matches = await db.searchPatientsByDemographics({
      firstName: input.first_name!,
      lastName: input.last_name!,
      dob: input.dob!,
      zip: input.zip,
    })
    if (matches.length === 0) {
      return {
        output: {
          error: { code: 'NOT_FOUND', message: 'No patient matched provided demographics' },
          matches: [],
        },
        patientId: null,
        policyId: null,
      }
    }
    if (matches.length > 1) {
      return {
        output: {
          error: { code: 'AMBIGUOUS_PATIENT', message: 'Multiple patients matched. Provide patient_id.' },
          matches,
        },
        patientId: null,
        policyId: null,
      }
    }
    patient = await db.getPatientById(matches[0].patient_id)
    if (!patient) {
      return {
        output: { error: { code: 'NOT_FOUND', message: 'Patient not found after match resolution' } },
        patientId: matches[0].patient_id,
        policyId: null,
      }
    }
    matchedBy = 'demographics'
  }

  if (!patient) {
    return {
      output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } },
      patientId: null,
      policyId: input.policy_id ?? null,
    }
  }

  const policies = await db.getInsurancePoliciesByPatientId(patient.id)
  if (!selectedPolicy) {
    selectedPolicy =
      (policies.find((p) => p.isPrimary) as Awaited<ReturnType<typeof db.getInsurancePolicyById>> | undefined) ??
      ((policies[0] as Awaited<ReturnType<typeof db.getInsurancePolicyById>> | undefined) ?? null)
  }

  const nameParts = getPatientNameParts(patient)
  const patientPhone = patient.primaryPhone || patient.phone || undefined
  const identity: Record<string, unknown> = {
    patient_id: patient.id,
    first_name: nameParts.firstName || undefined,
    last_name: nameParts.lastName || undefined,
    date_of_birth: patient.dateOfBirth?.toISOString().slice(0, 10),
    phone: patientPhone,
    email: patient.email || undefined,
  }
  if (input.include_address) {
    identity.address = {
      line1: patient.addressLine1 || undefined,
      line2: patient.addressLine2 || undefined,
      city: patient.city || undefined,
      state: patient.state || undefined,
      zip: patient.postalCode || undefined,
    }
  }

  const policiesOut = policies.map((p) => {
    const readiness = computeReadiness(p, patient!)
    return {
      policy_id: p.id,
      payer_name_raw: p.payerNameRaw,
      is_primary: p.isPrimary,
      plan_name: p.planName ?? undefined,
      plan_type: p.planType ?? undefined,
      member_id_masked: ctx.allowUnmasked ? p.memberId : maskLast4(p.memberId),
      completeness: {
        status: readiness.status,
        missing_fields: readiness.missing_fields,
        warnings: readiness.warnings,
      },
    }
  })

  let verificationBundle: Record<string, unknown> | null = null
  if (selectedPolicy) {
    const readiness = computeReadiness(selectedPolicy, patient)
    verificationBundle = {
      patient: {
        first_name: nameParts.firstName || undefined,
        last_name: nameParts.lastName || undefined,
        dob: patient.dateOfBirth?.toISOString().slice(0, 10),
        phone: patientPhone,
        ...(input.include_address
          ? {
              address: {
                line1: patient.addressLine1 || undefined,
                line2: patient.addressLine2 || undefined,
                city: patient.city || undefined,
                state: patient.state || undefined,
                zip: patient.postalCode || undefined,
              },
            }
          : {}),
      },
      insurance: {
        policy_id: selectedPolicy.id,
        payer_name_raw: selectedPolicy.payerNameRaw,
        member_id_masked: ctx.allowUnmasked ? selectedPolicy.memberId : maskLast4(selectedPolicy.memberId),
        group_number_masked: ctx.allowUnmasked
          ? (selectedPolicy.groupNumber ?? undefined)
          : (selectedPolicy.groupNumber ? maskLast4(selectedPolicy.groupNumber) : undefined),
        plan_name: selectedPolicy.planName ?? undefined,
        plan_type: selectedPolicy.planType ?? undefined,
        is_primary: selectedPolicy.isPrimary,
      },
      subscriber: {
        subscriber_is_patient: selectedPolicy.subscriberIsPatient,
        first_name: selectedPolicy.subscriberFirstName ?? undefined,
        last_name: selectedPolicy.subscriberLastName ?? undefined,
        dob: selectedPolicy.subscriberDob?.toISOString().slice(0, 10),
        relationship_to_patient: selectedPolicy.relationshipToPatient ?? undefined,
      },
      bcbs: {
        alpha_prefix: selectedPolicy.bcbsAlphaPrefix ?? undefined,
        state_plan: selectedPolicy.bcbsStatePlan ?? undefined,
      },
      ...(input.include_rx
        ? {
            rx: {
              rx_bin: selectedPolicy.rxBin ?? undefined,
              rx_pcn: selectedPolicy.rxPcn ?? undefined,
              rx_group: selectedPolicy.rxGroup ?? undefined,
            },
          }
        : {}),
      readiness: {
        status: readiness.status,
        missing_fields: readiness.missing_fields,
        warnings: readiness.warnings,
      },
    }
  }

  const output: Record<string, unknown> = {
    resolution: {
      matched_by: matchedBy,
      patient_id: patient.id,
      policy_id: selectedPolicy?.id ?? null,
    },
    patient_identity: identity,
    policies: policiesOut,
    verification_bundle: verificationBundle,
  }

  if (!selectedPolicy) {
    output.warning = 'No insurance policy found for patient'
  }

  await writeMcpAuditLog({
    ...ctx,
    patientId: patient.id,
    policyId: selectedPolicy?.id ?? null,
    toolName: 'get_insurance_verification_context',
    fieldsReturned: collectFieldPaths(output),
  })

  return { output, patientId: patient.id, policyId: selectedPolicy?.id ?? null }
}

export async function handleSearchPatientByDemographics(
  input: SearchPatientByDemographicsInput,
  ctx: RequestContext
): Promise<{ output: object; patientId: string | null }> {
  const matches = await db.searchPatientsByDemographics({
    firstName: input.first_name,
    lastName: input.last_name,
    dob: input.dob,
    zip: input.zip,
  })
  const output = { matches }
  await writeMcpAuditLog({
    ...ctx,
    patientId: null,
    policyId: null,
    toolName: 'search_patient_by_demographics',
    fieldsReturned: collectFieldPaths(output),
  })
  return { output, patientId: null }
}
