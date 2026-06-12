import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental MedicationPats API */
export declare class MedicationPatsService extends BaseDomainService {
    protected readonly resourcePath = "medicationpats";
    /** GET /medicationpats */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /medicationpats */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=MedicationPatsService.d.ts.map