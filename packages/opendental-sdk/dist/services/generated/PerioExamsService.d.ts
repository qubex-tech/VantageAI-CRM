import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental PerioExams API */
export declare class PerioExamsService extends BaseDomainService {
    protected readonly resourcePath = "perioexams";
    /** GET /perioexams */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /perioexams */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=PerioExamsService.d.ts.map