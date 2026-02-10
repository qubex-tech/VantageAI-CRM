/**
 * Data access for Patient and InsurancePolicy. Read-only.
 */
export declare const db: any;
export declare function getPatientById(patientId: string): Promise<any>;
export declare function getInsurancePoliciesByPatientId(patientId: string): Promise<any>;
export declare function getInsurancePolicyById(policyId: string): Promise<any>;
export declare function getPrimaryPolicyForPatient(patientId: string): Promise<any>;
/**
 * Search patients by demographics (first_name, last_name, dob; optional zip).
 * Returns matches with confidence and masked display.
 */
export declare function searchPatientsByDemographics(params: {
    firstName: string;
    lastName: string;
    dob: string;
    zip?: string;
}): Promise<any>;
//# sourceMappingURL=index.d.ts.map