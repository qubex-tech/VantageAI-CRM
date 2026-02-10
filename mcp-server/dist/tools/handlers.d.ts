import type { GetPatientIdentityInput, ListInsurancePoliciesInput, GetInsurancePolicyDetailsInput, GetVerificationBundleInput, SearchPatientByDemographicsInput } from './schemas.js';
export interface RequestContext {
    requestId: string;
    actorId: string;
    actorType: 'agent' | 'user' | 'system';
    purpose: string;
    allowUnmasked: boolean;
}
export declare function handleGetPatientIdentity(input: GetPatientIdentityInput, ctx: RequestContext): Promise<{
    output: object;
    patientId: string | null;
}>;
export declare function handleListInsurancePolicies(input: ListInsurancePoliciesInput, ctx: RequestContext): Promise<{
    output: object;
    patientId: string | null;
}>;
export declare function handleGetInsurancePolicyDetails(input: GetInsurancePolicyDetailsInput, ctx: RequestContext): Promise<{
    output: object;
    patientId: string | null;
    policyId: string | null;
}>;
export declare function handleGetVerificationBundle(input: GetVerificationBundleInput, ctx: RequestContext): Promise<{
    output: object;
    patientId: string | null;
    policyId: string | null;
}>;
export declare function handleSearchPatientByDemographics(input: SearchPatientByDemographicsInput, ctx: RequestContext): Promise<{
    output: object;
    patientId: string | null;
}>;
//# sourceMappingURL=handlers.d.ts.map