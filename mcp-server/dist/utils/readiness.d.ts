/**
 * Deterministic readiness for insurance verification (no clearinghouse calls).
 * Mirrors CRM logic: READY vs NEEDS_INFO; missing_fields and warnings.
 */
export type ReadinessStatus = 'READY' | 'NEEDS_INFO';
export interface MissingField {
    field: string;
    reason: string;
}
export interface ReadinessResult {
    status: ReadinessStatus;
    missing_fields: MissingField[];
    warnings: {
        field: string;
        reason: string;
    }[];
}
export declare function computeReadiness(policy: {
    payerNameRaw: string;
    memberId: string;
    subscriberIsPatient: boolean;
    subscriberFirstName?: string | null;
    subscriberLastName?: string | null;
    subscriberDob?: Date | string | null;
    relationshipToPatient?: string | null;
    bcbsAlphaPrefix?: string | null;
}, patient: {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    dateOfBirth?: Date | string | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
}): ReadinessResult;
//# sourceMappingURL=readiness.d.ts.map