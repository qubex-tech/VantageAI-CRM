import { z } from 'zod';
export declare const getPatientIdentityInput: z.ZodObject<{
    patient_id: z.ZodString;
    include_address: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    patient_id: string;
    include_address: boolean;
}, {
    patient_id: string;
    include_address?: boolean | undefined;
}>;
export declare const listInsurancePoliciesInput: z.ZodObject<{
    patient_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    patient_id: string;
}, {
    patient_id: string;
}>;
export declare const getInsurancePolicyDetailsInput: z.ZodObject<{
    policy_id: z.ZodString;
    include_rx: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    include_card_refs: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    policy_id: string;
    include_rx: boolean;
    include_card_refs: boolean;
}, {
    policy_id: string;
    include_rx?: boolean | undefined;
    include_card_refs?: boolean | undefined;
}>;
export declare const getVerificationBundleInput: z.ZodObject<{
    patient_id: z.ZodString;
    policy_id: z.ZodOptional<z.ZodString>;
    include_address: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    include_rx: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    strict_minimum_necessary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    patient_id: string;
    include_address: boolean;
    include_rx: boolean;
    strict_minimum_necessary: boolean;
    policy_id?: string | undefined;
}, {
    patient_id: string;
    include_address?: boolean | undefined;
    policy_id?: string | undefined;
    include_rx?: boolean | undefined;
    strict_minimum_necessary?: boolean | undefined;
}>;
export declare const searchPatientByDemographicsInput: z.ZodObject<{
    first_name: z.ZodString;
    last_name: z.ZodString;
    dob: z.ZodString;
    zip: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    first_name: string;
    last_name: string;
    dob: string;
    zip?: string | undefined;
}, {
    first_name: string;
    last_name: string;
    dob: string;
    zip?: string | undefined;
}>;
export type GetPatientIdentityInput = z.infer<typeof getPatientIdentityInput>;
export type ListInsurancePoliciesInput = z.infer<typeof listInsurancePoliciesInput>;
export type GetInsurancePolicyDetailsInput = z.infer<typeof getInsurancePolicyDetailsInput>;
export type GetVerificationBundleInput = z.infer<typeof getVerificationBundleInput>;
export type SearchPatientByDemographicsInput = z.infer<typeof searchPatientByDemographicsInput>;
//# sourceMappingURL=schemas.d.ts.map