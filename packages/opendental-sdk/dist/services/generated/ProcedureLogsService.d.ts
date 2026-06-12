import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ProcedureLogs API */
export declare class ProcedureLogsService extends BaseDomainService {
    protected readonly resourcePath = "procedurelogs";
    /** GET /procedurelogs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /insurancehistory */
    getInsuranceHistory(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /procedurelogs */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /insurancehistory */
    createInsuranceHistory(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
    /** POST /groupnote */
    createGroupNote(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /groupnote */
    updateGroupNote(body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /groupnote */
    deleteGroupNote(): Promise<unknown>;
}
//# sourceMappingURL=ProcedureLogsService.d.ts.map