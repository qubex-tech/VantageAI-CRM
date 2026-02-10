/**
 * Audit every MCP tool call: who, when, purpose, patient_id, policy_id, tool_name, fields returned (paths only).
 */
export type ActorType = 'agent' | 'user' | 'system';
export interface AuditParams {
    requestId: string;
    actorId: string;
    actorType: ActorType;
    purpose: string;
    patientId: string | null;
    policyId: string | null;
    toolName: string;
    /** Array of field paths returned (e.g. ["patient.first_name", "insurance.member_id_masked"]), NOT values */
    fieldsReturned: string[];
}
export declare function writeMcpAuditLog(params: AuditParams): Promise<void>;
/**
 * Collect field paths from an output object (for audit). Returns paths like "patient.first_name", "insurance.member_id_masked".
 */
export declare function collectFieldPaths(obj: unknown, prefix?: string): string[];
//# sourceMappingURL=audit.d.ts.map