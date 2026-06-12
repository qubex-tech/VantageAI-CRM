import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PatientNotes API */
export declare class PatientNotesService extends BaseDomainService {
    protected readonly resourcePath = "patientnotes";
    /** GET /patientnotes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=PatientNotesService.d.ts.map