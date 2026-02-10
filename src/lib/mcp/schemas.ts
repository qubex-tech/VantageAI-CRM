import { z } from 'zod'

const uuid = z.string().uuid()

export const getPatientIdentityInput = z.object({
  patient_id: uuid,
  include_address: z.boolean().optional().default(false),
})

export const listInsurancePoliciesInput = z.object({
  patient_id: uuid,
})

export const getInsurancePolicyDetailsInput = z.object({
  policy_id: uuid,
  include_rx: z.boolean().optional().default(false),
  include_card_refs: z.boolean().optional().default(false),
})

export const getVerificationBundleInput = z.object({
  patient_id: uuid,
  policy_id: uuid.optional(),
  include_address: z.boolean().optional().default(false),
  include_rx: z.boolean().optional().default(false),
  strict_minimum_necessary: z.boolean().optional().default(true),
})

export const searchPatientByDemographicsInput = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  dob: z.string().min(1),
  zip: z.string().optional(),
})

export type GetPatientIdentityInput = z.infer<typeof getPatientIdentityInput>
export type ListInsurancePoliciesInput = z.infer<typeof listInsurancePoliciesInput>
export type GetInsurancePolicyDetailsInput = z.infer<typeof getInsurancePolicyDetailsInput>
export type GetVerificationBundleInput = z.infer<typeof getVerificationBundleInput>
export type SearchPatientByDemographicsInput = z.infer<typeof searchPatientByDemographicsInput>
