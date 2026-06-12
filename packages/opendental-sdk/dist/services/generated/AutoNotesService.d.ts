import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental AutoNotes API */
export declare class AutoNotesService extends BaseDomainService {
    protected readonly resourcePath = "autonotes";
    /** GET /autonotes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /autonotes */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=AutoNotesService.d.ts.map