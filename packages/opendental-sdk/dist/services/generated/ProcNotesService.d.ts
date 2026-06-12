import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ProcNotes API */
export declare class ProcNotesService extends BaseDomainService {
    protected readonly resourcePath = "procnotes";
    /** GET /procnotes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /procnotes */
    create(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ProcNotesService.d.ts.map