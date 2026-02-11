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
  patient_id: uuid.optional(),
  policy_id: uuid.optional(),
  include_address: z.boolean().optional().default(false),
  include_rx: z.boolean().optional().default(false),
  strict_minimum_necessary: z.boolean().optional().default(true),
}).refine((v) => !!v.patient_id || !!v.policy_id, {
  message: 'Provide patient_id or policy_id',
  path: ['patient_id'],
})

export const getInsuranceVerificationContextInput = z.object({
  patient_id: uuid.optional(),
  policy_id: uuid.optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  dob: z.string().min(1).optional(),
  zip: z.string().optional(),
  include_address: z.boolean().optional().default(true),
  include_rx: z.boolean().optional().default(true),
  strict_minimum_necessary: z.boolean().optional().default(true),
}).refine(
  (v) => !!v.patient_id || !!v.policy_id || (!!v.first_name && !!v.last_name && !!v.dob),
  {
    message: 'Provide patient_id, policy_id, or (first_name, last_name, dob)',
    path: ['patient_id'],
  }
)

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
export type GetInsuranceVerificationContextInput = z.infer<typeof getInsuranceVerificationContextInput>
