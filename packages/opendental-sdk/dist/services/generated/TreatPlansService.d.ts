import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental TreatPlans API */
export declare class TreatPlansService extends BaseDomainService {
    protected readonly resourcePath = "treatplans";
    /** GET /treatplans */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /treatplans */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /saved */
    createSaved(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=TreatPlansService.d.ts.map